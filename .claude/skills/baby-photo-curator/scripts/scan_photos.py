#!/usr/bin/env python3
"""
아기 사진 백로그 스캔 스크립트 (baby-photo-curator 스킬용).

두 개의 서브커맨드를 제공한다:

  scan    - 소스 폴더를 훑어서 흐릿한 사진 / 중복(버스트 샷) 그룹을 찾아내고
            사람이 확인하기 좋은 리포트(JSON + Markdown)를 만든다.
            절대 파일을 지우거나 옮기지 않는다 - 추천만 한다.

  select  - 사용자가 고른 사진들을 촬영일 기준 YYYY-MM 폴더로 복사한다.
            (원본은 그대로 두고 복사만 한다 - 실수로 원본을 잃지 않도록)

의존성: Pillow, numpy, imagehash. HEIC 원본을 그대로 다루려면 pillow-heif도 필요.
    pip install Pillow numpy imagehash pillow-heif
"""

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ExifTags

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pass

try:
    import imagehash
except ImportError:
    print(
        "imagehash 패키지가 필요합니다: pip install imagehash", file=sys.stderr
    )
    sys.exit(1)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
STATE_FILENAME = ".baby_photo_curator_state.json"
MAX_SCAN_DIM = 800  # 속도를 위해 이 크기로 축소해서 분석
DUPLICATE_HASH_DISTANCE = 6  # 이 이하면 "거의 같은 사진"으로 취급
BLUR_PERCENTILE = 0.2  # 선명도 하위 20%를 블러 후보로 추천


@dataclass
class PhotoInfo:
    path: Path
    taken_at: datetime
    sharpness: float
    phash: "imagehash.ImageHash | None"
    error: str | None = None


def load_state(state_path: Path) -> dict:
    if state_path.exists():
        return json.loads(state_path.read_text(encoding="utf-8"))
    return {"last_scan": None}


def save_state(state_path: Path, last_scan: str) -> None:
    state_path.write_text(
        json.dumps({"last_scan": last_scan}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def get_taken_at(img: Image.Image, fallback_mtime: float) -> datetime:
    try:
        exif = img.getexif()
        if exif:
            for tag_id, value in exif.items():
                tag = ExifTags.TAGS.get(tag_id)
                if tag == "DateTimeOriginal" and value:
                    return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return datetime.fromtimestamp(fallback_mtime)


def sharpness_score(gray: np.ndarray) -> float:
    """라플라시안 분산 - 값이 낮을수록 흐릿한 사진."""
    kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float64)
    h, w = gray.shape
    lap = np.zeros((h - 2, w - 2))
    for dy in range(3):
        for dx in range(3):
            weight = kernel[dy, dx]
            if weight == 0:
                continue
            lap += weight * gray[dy : dy + h - 2, dx : dx + w - 2]
    return float(lap.var())


def analyze_photo(path: Path) -> PhotoInfo:
    try:
        with Image.open(path) as img:
            img = img.convert("RGB")
            taken_at = get_taken_at(img, path.stat().st_mtime)
            phash = imagehash.phash(img)

            small = img.copy()
            small.thumbnail((MAX_SCAN_DIM, MAX_SCAN_DIM))
            gray = np.array(small.convert("L"), dtype=np.float64)
            sharpness = sharpness_score(gray)

            return PhotoInfo(
                path=path, taken_at=taken_at, sharpness=sharpness, phash=phash
            )
    except Exception as e:  # noqa: BLE001 - 사진 하나 실패해도 나머지는 계속 진행
        return PhotoInfo(
            path=path,
            taken_at=datetime.fromtimestamp(path.stat().st_mtime),
            sharpness=0.0,
            phash=None,
            error=str(e),
        )


def find_candidate_files(source: Path, since: datetime | None) -> list[Path]:
    files = []
    for p in source.rglob("*"):
        if p.suffix.lower() in IMAGE_EXTS and p.is_file():
            if since is None or datetime.fromtimestamp(p.stat().st_mtime) > since:
                files.append(p)
    return sorted(files)


def group_duplicates(photos: list[PhotoInfo]) -> tuple[list[list[PhotoInfo]], list[PhotoInfo]]:
    """phash 거리가 가까운 사진들을 그룹으로 묶는다. 반환: (그룹들, 그룹에 안 속한 나머지)"""
    valid = [p for p in photos if p.phash is not None]
    used: set[int] = set()
    groups: list[list[PhotoInfo]] = []

    for i, p in enumerate(valid):
        if i in used:
            continue
        group = [p]
        used.add(i)
        for j in range(i + 1, len(valid)):
            if j in used:
                continue
            if p.phash - valid[j].phash <= DUPLICATE_HASH_DISTANCE:
                group.append(valid[j])
                used.add(j)
        if len(group) > 1:
            groups.append(group)

    grouped_paths = {p.path for g in groups for p in g}
    ungrouped = [p for p in photos if p.path not in grouped_paths]
    return groups, ungrouped


def cmd_scan(args: argparse.Namespace) -> None:
    source = Path(args.source).expanduser().resolve()
    if not source.is_dir():
        print(f"소스 폴더를 찾을 수 없습니다: {source}", file=sys.stderr)
        sys.exit(1)

    report_dir = Path(args.report_dir).expanduser().resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    state_path = report_dir / STATE_FILENAME

    state = load_state(state_path)
    since = datetime.fromisoformat(state["last_scan"]) if (state.get("last_scan") and not args.all) else None

    files = find_candidate_files(source, since)
    print(f"스캔 대상 파일 {len(files)}개 발견 (source={source})")

    photos = [analyze_photo(f) for f in files]
    errors = [p for p in photos if p.error]
    ok_photos = [p for p in photos if not p.error]

    duplicate_groups, ungrouped = group_duplicates(ok_photos)

    grouped_paths = {p.path for g in duplicate_groups for p in g}
    non_duplicate = [p for p in ok_photos if p.path not in grouped_paths]

    if non_duplicate:
        sharp_values = sorted(p.sharpness for p in non_duplicate)
        cutoff_idx = max(0, int(len(sharp_values) * BLUR_PERCENTILE) - 1)
        blur_threshold = sharp_values[cutoff_idx]
    else:
        blur_threshold = 0.0

    blurry = [p for p in non_duplicate if p.sharpness <= blur_threshold]
    remaining = [p for p in non_duplicate if p.sharpness > blur_threshold]

    report = {
        "scanned_at": datetime.now().isoformat(),
        "source": str(source),
        "total_scanned": len(files),
        "errors": [{"path": str(p.path), "error": p.error} for p in errors],
        "duplicate_groups": [
            {
                "recommend_keep": str(max(g, key=lambda p: p.sharpness).path),
                "members": [
                    {
                        "path": str(p.path),
                        "taken_at": p.taken_at.isoformat(),
                        "sharpness": round(p.sharpness, 1),
                    }
                    for p in sorted(g, key=lambda p: -p.sharpness)
                ],
            }
            for g in duplicate_groups
        ],
        "blurry_recommend_delete": [
            {
                "path": str(p.path),
                "taken_at": p.taken_at.isoformat(),
                "sharpness": round(p.sharpness, 1),
            }
            for p in sorted(blurry, key=lambda p: p.sharpness)
        ],
        "remaining_candidates": [
            {"path": str(p.path), "taken_at": p.taken_at.isoformat()}
            for p in sorted(remaining, key=lambda p: p.taken_at)
        ],
    }

    report_json = report_dir / "scan_report.json"
    report_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    md_lines = [
        f"# 사진 정리 리포트 ({report['scanned_at'][:16].replace('T', ' ')})",
        "",
        f"- 소스: `{source}`",
        f"- 이번에 스캔한 파일: {len(files)}개",
        f"- 열기 실패: {len(errors)}개",
        f"- 중복(버스트) 그룹: {len(duplicate_groups)}개",
        f"- 블러 삭제 추천: {len(blurry)}개",
        f"- 남은 선택 후보(사용자가 직접 고를 것): {len(remaining)}개",
        "",
    ]

    if duplicate_groups:
        md_lines.append("## 중복/연사 그룹 (하나만 남기는 걸 추천)")
        for g in report["duplicate_groups"]:
            md_lines.append(f"- 추천 보관: `{g['recommend_keep']}`")
            for m in g["members"]:
                mark = "✅ 보관추천" if m["path"] == g["recommend_keep"] else "❌ 삭제후보"
                md_lines.append(f"  - {mark} {m['path']} (선명도 {m['sharpness']})")
        md_lines.append("")

    if blurry:
        md_lines.append("## 블러 삭제 추천")
        for p in report["blurry_recommend_delete"]:
            md_lines.append(f"- {p['path']} (선명도 {p['sharpness']}, {p['taken_at'][:10]})")
        md_lines.append("")

    md_lines.append("## 선택 후보 (직접 베스트샷 고르기)")
    for p in report["remaining_candidates"]:
        md_lines.append(f"- {p['taken_at'][:10]}  {p['path']}")

    (report_dir / "scan_report.md").write_text("\n".join(md_lines), encoding="utf-8")

    if not args.dry_run:
        save_state(state_path, report["scanned_at"])

    print(f"리포트 저장됨: {report_json}")
    print(f"          also: {report_dir / 'scan_report.md'}")


def cmd_select(args: argparse.Namespace) -> None:
    dest_root = Path(args.dest).expanduser().resolve()
    dest_root.mkdir(parents=True, exist_ok=True)

    for raw_path in args.files:
        src = Path(raw_path).expanduser()
        if not src.is_file():
            print(f"건너뜀 (파일 없음): {src}", file=sys.stderr)
            continue

        try:
            with Image.open(src) as img:
                taken_at = get_taken_at(img, src.stat().st_mtime)
        except Exception:
            taken_at = datetime.fromtimestamp(src.stat().st_mtime)

        month_dir = dest_root / taken_at.strftime("%Y-%m")
        month_dir.mkdir(parents=True, exist_ok=True)

        target = month_dir / src.name
        counter = 1
        while target.exists():
            target = month_dir / f"{src.stem}_{counter}{src.suffix}"
            counter += 1

        target.write_bytes(src.read_bytes())
        print(f"복사됨: {src} -> {target}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    scan_p = sub.add_parser("scan", help="소스 폴더 스캔 -> 블러/중복 리포트 생성")
    scan_p.add_argument("--source", required=True, help="iCloud 사진 동기화 폴더 경로")
    scan_p.add_argument("--report-dir", required=True, help="리포트/상태 저장 폴더")
    scan_p.add_argument("--all", action="store_true", help="마지막 스캔 이후가 아니라 전체를 다시 스캔")
    scan_p.add_argument("--dry-run", action="store_true", help="상태 파일을 갱신하지 않음(테스트용)")
    scan_p.set_defaults(func=cmd_scan)

    select_p = sub.add_parser("select", help="고른 사진들을 촬영월 폴더로 복사")
    select_p.add_argument("--dest", required=True, help="정리된 사진을 저장할 폴더 (예: .../정리완료)")
    select_p.add_argument("files", nargs="+", help="복사할 원본 사진 경로들")
    select_p.set_defaults(func=cmd_select)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

# V6.5.1 QA

## Defect
Equipment & Services table exceeded printable A4 width. The Amount column was clipped and the browser horizontal scrollbar could be captured in Print / Save PDF output.

## Validation
PASS
- 7 receipt columns total exactly 100% width.
- Print wrapper uses overflow: visible.
- Print table uses fixed layout and A4 portrait page sizing.
- Rate and Amount use nowrap.
- Description and Asset / Serial can wrap.
- Programmatic PDF positions keep Amount inside the right page margin.
- OUT/IN condition columns remain absent.
- No database migration required.

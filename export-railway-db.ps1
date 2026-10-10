$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

Write-Host ''
Write-Host 'Abyss 실제 운영 MySQL DB 백업' -ForegroundColor Cyan
Write-Host '이 도구는 원본 DB를 읽기만 하며, 데이터 삭제/변경 SQL을 실행하지 않습니다.'
Write-Host ''

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'package.json'))) {
  Write-Host '오류: 이 파일을 Abyss 프로젝트 최상위 폴더에 넣고 실행해 주세요.' -ForegroundColor Red
  exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\mysql2\package.json'))) {
  Write-Host '오류: Abyss 프로젝트의 node_modules/mysql2를 찾을 수 없습니다.' -ForegroundColor Red
  Write-Host 'Abyss 폴더에서 패키지 설치를 먼저 해야 합니다. 설치가 어렵다면 MySQL Workbench 방식으로 내보내 주세요.'
  exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '오류: Node.js가 설치되어 있지 않습니다.' -ForegroundColor Red
  exit 1
}

$secureUrl = Read-Host 'Railway의 MYSQL_PUBLIC_URL을 붙여넣으세요 (입력 내용은 화면에 표시되지 않습니다)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
try {
  $plainUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($plainUrl)) {
    Write-Host '연결 주소를 입력하지 않았습니다.' -ForegroundColor Red
    exit 1
  }
  $env:DATABASE_URL = $plainUrl
  node (Join-Path $PSScriptRoot 'export-railway-db.mjs')
  if ($LASTEXITCODE -ne 0) {
    Write-Host '백업에 실패했습니다. Railway 공개 연결 주소와 접근 권한을 확인해 주세요.' -ForegroundColor Red
    exit $LASTEXITCODE
  }
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $plainUrl = $null
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
Write-Host ''
Write-Host '완료. 생성된 Abyss-live-db-*.sql 파일을 안전한 위치에 보관하세요.' -ForegroundColor Green

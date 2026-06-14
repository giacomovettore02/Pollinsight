param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Z]:$')]
    [string]$BootDrive
)

$ErrorActionPreference = 'Stop'

$bootRoot = "$BootDrive\"
$issuePath = Join-Path $bootRoot 'issue.txt'
$cmdlinePath = Join-Path $bootRoot 'cmdline.txt'
$configPath = Join-Path $bootRoot 'config.txt'
$firstRunPath = Join-Path $bootRoot 'firstrun.sh'
$payloadSource = Split-Path -Parent $PSCommandPath
$payloadTarget = Join-Path $bootRoot 'pollinsight-fona'

if (-not (Test-Path -LiteralPath $issuePath)) {
    throw "$BootDrive is not a Raspberry Pi boot partition."
}
if (-not (Test-Path -LiteralPath $firstRunPath)) {
    throw 'Raspberry Pi Imager first-run customization is missing.'
}
if (-not (Test-Path -LiteralPath (Join-Path $payloadSource '.env'))) {
    throw 'Create raspberry-fona\.env before preparing the SD card.'
}
if (Test-Path -LiteralPath $payloadTarget) {
    throw "$payloadTarget already exists. Refusing to overwrite it."
}

$excludedNames = @(
    'logs',
    'state',
    'archive',
    '__pycache__',
    'prepare-sd-card.ps1'
)
$entries = Get-ChildItem -LiteralPath $payloadSource -Force |
    Where-Object { $_.Name -notin $excludedNames }

New-Item -ItemType Directory -Path $payloadTarget | Out-Null
foreach ($entry in $entries) {
    Copy-Item -LiteralPath $entry.FullName -Destination $payloadTarget -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $payloadTarget 'logs') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $payloadTarget 'state') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $payloadTarget 'archive') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $payloadTarget 'images\inbox') -Force | Out-Null

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
Get-ChildItem -LiteralPath $payloadTarget -Recurse -File |
    Where-Object { $_.Extension -in @('.sh', '.service', '.txt') } |
    ForEach-Object {
        $content = [System.IO.File]::ReadAllText($_.FullName)
        [System.IO.File]::WriteAllText(
            $_.FullName,
            ($content -replace "`r`n", "`n"),
            $utf8NoBom
        )
    }

$config = [System.IO.File]::ReadAllText($configPath)
$config = $config.Replace('#dtparam=i2c_arm=on', 'dtparam=i2c_arm=on')
[System.IO.File]::WriteAllText(
    $configPath,
    ($config -replace "`r`n", "`n"),
    $utf8NoBom
)

$firstRun = [System.IO.File]::ReadAllText($firstRunPath)
$marker = "rm -f /boot/firstrun.sh"
$bootstrapCommand = "if [ -d /boot/firmware/pollinsight-fona ]; then sh /boot/firmware/pollinsight-fona/firstboot-install.sh; else sh /boot/pollinsight-fona/firstboot-install.sh; fi"
if (-not $firstRun.Contains($bootstrapCommand)) {
    if (-not $firstRun.Contains($marker)) {
        throw 'Could not locate the Raspberry Pi Imager cleanup marker.'
    }
    $firstRun = $firstRun.Replace($marker, "$bootstrapCommand`n$marker")
}
[System.IO.File]::WriteAllText(
    $firstRunPath,
    ($firstRun -replace "`r`n", "`n"),
    $utf8NoBom
)

$cmdline = [System.IO.File]::ReadAllText($cmdlinePath).Trim()
if ($cmdline -notmatch 'systemd\.run=/boot/firstrun\.sh') {
    throw 'The first-boot command is missing from cmdline.txt.'
}

$requiredFiles = @(
    'pollinsight-fona\.env',
    'pollinsight-fona\install.sh',
    'pollinsight-fona\firstboot-install.sh',
    'pollinsight-fona\pollinsight-fona-bootstrap.service',
    'pollinsight-fona\pollinsight-fona-ppp.service',
    'pollinsight-fona\pollinsight-fona.service',
    'pollinsight-fona\model\varroa_mobilenetv2_160.tflite',
    'pollinsight-fona\pollinsight_fona\main.py'
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $bootRoot $relativePath))) {
        throw "Required file missing after copy: $relativePath"
    }
}

$sampleCount = (
    Get-ChildItem -LiteralPath (Join-Path $payloadTarget 'sample-images') -File
).Count
if ($sampleCount -lt 1) {
    throw 'At least one sample image is required.'
}

Write-Output "PollinSight FONA SD card prepared successfully on $BootDrive"
Write-Output 'The first installation needs temporary Internet access for packages.'

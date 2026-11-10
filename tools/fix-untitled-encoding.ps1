$ErrorActionPreference = 'Stop'
$p = (Resolve-Path (Join-Path $PSScriptRoot '..\docs\Untitled-1.txt')).Path
$t = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)

# Mojibake produced by decoding UTF-8 bytes as Windows-1251
$t = $t.Replace([string][char]0x0432 + [string][char]0x0402 + [string][char]0x201D, [string][char]0x2014) # em dash
$t = $t.Replace([string][char]0x0432 + [string][char]0x201E + [string][char]0x2116, [string][char]0x2139) # info sign
$t = $t.Replace([string][char]0x0432 + [string][char]0x0401 + [string][char]0x0020, '')                    # invisible char
$t = $t.Replace([string][char]0x0432 + [string][char]0x0401 + [string][char]0x00A9, '')                    # invisible char

$t = $t.Replace([string][char]0x2139 + [string][char]0x043F + [string][char]0x0451 + [string][char]0x040F, [string][char]0x2139) # info emoji tail

[IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("remaining mojibake lines: " + (Select-String -Path $p -Pattern ([string][char]0x0432 + [string][char]0x0402) -SimpleMatch | Measure-Object).Count)

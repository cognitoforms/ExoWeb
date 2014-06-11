[CmdletBinding()]
param(
	[Parameter(Mandatory=$true, HelpMessage="The names of the modules to include in the combined script.")]
	[string[]]$Modules,

	[Parameter(Mandatory=$false, HelpMessage="The namespaces that the script will export.")]
	[string[]]$Namespaces,

	[Parameter(Mandatory=$true, HelpMessage="The path to write the resulting file.")]
	[string]$DestinationPath,

	[Parameter(Mandatory=$false, HelpMessage="Optional text to include at the beginning of the file.")]
	[string]$BannerText,

	[Parameter(Mandatory=$false, HelpMessage="Optional text to include at the end of the file.")]
	[string]$FooterText,

	[Parameter(Mandatory=$false, HelpMessage="Whether to force build the file even if no source files have changed.")]
	[switch]$Force
)

try {
	. (Join-Path (Split-Path $MyInvocation.MyCommand.Path) lib\Common.ps1)
	. (Join-Path (Split-Path $MyInvocation.MyCommand.Path) lib\ScriptBuilder.ps1)

	$destinationFile = Split-Path $DestinationPath -Leaf

	Write-Host "Running build '$($destinationFile)'..."

	$dir = Split-Path $MyInvocation.MyCommand.Path -Parent

	if (!$Force.IsPresent) {
		if (!(ShouldBuild)) {
			Write-Host "No changes detected."
			return
		}
	}

	$outFile = Resolve-Path (Join-Path $dir $DestinationPath)

	Write-Verbose "Modules: $Modules"
	Write-Verbose "Destination: $DestinationPath"

	Write-Host "Checking out '$($destinationFile)' (if needed)..."
	CheckoutFile $outFile

	$contents = GetScriptSourceText -Modules $Modules -Namespaces $Namespaces -BannerText $BannerText -FooterText $FooterText
	$utf8NoBomEncoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
	[System.IO.File]::WriteAllLines($outFile, $contents, $utf8NoBomEncoding)

	Write-Host "File '$($destinationFile)' created."
}
catch {
	Write-Error $_.Exception.Message
	exit 1
}
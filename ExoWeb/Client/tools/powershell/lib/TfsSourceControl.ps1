$dir = Split-Path $MyInvocation.MyCommand.Path -Parent

. (Join-Path (Split-Path $MyInvocation.MyCommand.Path) Common.ps1)

$programFiles = if (Test-Path "C:\Program Files (x86)") { "C:\Program Files (x86)" } else { "C:\Program Files" }

$tf2010 = "$programFiles\Microsoft Visual Studio 10.0\Common7\IDE\TF.exe"
$tf2012 = "$programFiles\Microsoft Visual Studio 11.0\Common7\IDE\TF.exe"
$tf2013 = "$programFiles\Microsoft Visual Studio 12.0\Common7\IDE\TF.exe"

function GetTfExePath
{
	param (
		[Parameter(Mandatory=$false)]
		[ValidateSet("*", "2010", "2012", "2013")]
		[string]$Version="*"
	)

	if ($Version -eq "*") {
		# Automatically detect supported versions
		if (Test-Path $tf2013) {
			return $tf2013
		}
		elseif (Test-Path $tf2012) {
			return $tf2012
		}
	}

	if ($Version -eq 2010) {
		return $tf2010
	}
	elseif ($Version -eq 2012) {
		return $tf2012
	}
	elseif ($Version -eq 2013) {
		return $tf2013
	}
}

function IsLocalWorkspace {
	[CmdletBinding()]
	param(
	)

	$exe = GetTfExePath

	$user = GetCurrentUser -Kind LoggedIn -KeepDomain
	if (!$user) {
		$user = GetCurrentUser -Kind Running -KeepDomain
	}

	$output = RunExe -FilePath $exe -Arguments "workspaces /owner:$user /computer:$env:COMPUTERNAME /format:detailed"

	foreach ($line in ($output -split [System.Environment]::NewLine)) {
		if ($line -match "^Location\s*:") {
			$value = $line -replace "^Location\s*:(.*)$", '$1'
			return $value.Trim() -eq "Local"
		}
	}

	return $false
}

function ShouldBuild {
	[CmdletBinding()]
	param(
	)

	$isLocal = IsLocalWorkspace
	if ($isLocal) {
		return $true
	}

	$target = (Resolve-Path (Join-Path $dir '..\..\src')).Path + '\*.js'

	Write-Verbose "Getting status '$($target)'..."

	$exe = GetTfExePath
	$output = RunExe -FilePath $exe -Arguments "status ""$target"" /recursive"

	return $output.Trim() -ne "There are no pending changes."
}

function CheckoutFile {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory=$true, HelpMessage="The file to check out for edit.")]
		[string]$Item
	)

	Write-Verbose "Checking out file '$($Item)'..."

	if (IsLocalWorkspace) {
		Write-Verbose "File does not need to be checked out from a local workspace."
	}
	else {
		$exe = GetTfExePath
		$output = RunExe -FilePath $exe -Arguments "checkout ""$Item"""
	}
}

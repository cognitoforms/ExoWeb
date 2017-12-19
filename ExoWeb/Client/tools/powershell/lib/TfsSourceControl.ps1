$dir = Split-Path $MyInvocation.MyCommand.Path -Parent

. (Join-Path (Split-Path $MyInvocation.MyCommand.Path) Common.ps1)

$programFiles = if (Test-Path "C:\Program Files (x86)") { "C:\Program Files (x86)" } else { "C:\Program Files" }

$tf2010 = "$programFiles\Microsoft Visual Studio 10.0\Common7\IDE\TF.exe"
$tf2012 = "$programFiles\Microsoft Visual Studio 11.0\Common7\IDE\TF.exe"
$tf2013 = "$programFiles\Microsoft Visual Studio 12.0\Common7\IDE\TF.exe"
$tf2015 = "$programFiles\Microsoft Visual Studio 14.0\Common7\IDE\TF.exe"
$tf2017 = "$programFiles\Microsoft Visual Studio\2017\Enterprise\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\TF.exe"

function GetTfExePath
{
	param (
		[Parameter(Mandatory=$false)]
		[ValidateSet("*", "2010", "2012", "2013", "2015")]
		[string]$Version="*"
	)

	if ($Version -eq "*") {
		# Automatically detect supported versions
		if (Test-Path $tf2017) {
			return $tf2017
		}
		elseif (Test-Path $tf2015) {
			return $tf2015
		}
		elseif (Test-Path $tf2013) {
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
	elseif ($Version -eq 2015) {
		return $tf2015
	}
	elseif ($Version -eq 2017) {
		return $tf2017
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
		[string]$SourceRoot,
		[string]$DestinationPath
	)

	$isLocal = IsLocalWorkspace
	if ($isLocal) {
		Write-Verbose "Determining whether to build based on file modification dates..."
		Write-Verbose "Source: $SourceRoot"
		Write-Verbose "Destination: $SourceRoot"

		if (!(Test-Path $DestinationPath)) {
			Write-Verbose "Destination file '$($DestinationPath)' doesn't exist, so build will proceed."
			return $true
		}

		Write-Verbose "Checking last write time of source  and destination files..."
		$sourceChangedDate = (Get-ChildItem $SourceRoot -Filter "*.js" -Recurse | ForEach-Object -MemberName LastWriteTime | Measure-Object -Maximum).Maximum
		$destinationChangedDate = (Get-Item $DestinationPath).LastWriteTime
		if ($sourceChangedDate -gt $destinationChangedDate) {
			Write-Verbose "Source file(s) were modified on '$($sourceChangedDate.ToString())', which is more recent than destination modified date of '$($destinationChangedDate.ToString())', so build will proceed."
			return $true
		}
		else {
			Write-Verbose "Source file(s) were modified on '$($sourceChangedDate.ToString())', which is older than destination modified date of '$($destinationChangedDate.ToString())', so build is not necessary."
			return $false
		}
	}

	Write-Verbose "Determining whether to build based on the existence of pending changes..."
	Write-Verbose "Source: $SourceRoot"

	$target = (Resolve-Path $SourceRoot).Path + '\*.js'

	Write-Verbose "Getting status '$($target)'..."

	$exe = GetTfExePath
	$output = RunExe -FilePath $exe -Arguments "status ""$target"" /recursive"

	if ($output.Trim() -eq "There are no pending changes.") {
		Write-Verbose "Source files do not have pending changes, so build is not necessary."
		return $false
	}
	else {
		Write-Verbose "Source files have pending changes, so build will proceed."
		return $true
	}
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

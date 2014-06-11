function GetCurrentUser {
	param(
		[Parameter(Mandatory=$false, Position=0)]
		[ValidateSet('LoggedIn', 'Running')]
		[string]$Kind='LoggedIn',

		[Parameter(Mandatory=$false, Position=1)]
		[switch]$KeepDomain
	)

	switch ($Kind) {
		LoggedIn {
			$currentUser = (Get-WMIObject -class Win32_ComputerSystem | select Username).Username
			if ($currentUser -match "\\" -and !$KeepDomain.IsPresent) {
				$currentUser = $currentUser.Substring($currentUser.IndexOf("\") + 1)
			}
			return $currentUser
		}
		Running {
			if ($KeepDomain.IsPresent -and $env:USERDOMAIN) {
				$currentUser = $env:USERDOMAIN + "\" + $env:USERNAME
			}
			else {
				$currentUser = $env:USERNAME
			}
			return $currentUser
		}
	}
}

function RunExe
{
	param (
		[Parameter(Mandatory=$true)]
		[string]$FilePath,

		[Parameter(Mandatory=$true)]
		[string]$Arguments
	)

	if (!$FilePath) {
		throw "First argument must be the name of an executable!"
	}

	if (!(Test-Path $FilePath)) {
		throw "Executable path ""$FilePath"" does not exist!"
	}

	$process = New-Object System.Diagnostics.Process

	$process.StartInfo.FileName = $FilePath
	$process.StartInfo.WorkingDirectory = (Get-Location).Path
	$process.StartInfo.Arguments = $Arguments
	$process.StartInfo.UseShellExecute = $false
	$process.StartInfo.RedirectStandardOutput = $true
	$process.StartInfo.RedirectStandardError = $true

	# start the process and begin reading stdout and stderr
	[void]$process.Start()

	$outputStream = $process.StandardOutput
	$output = $outputStream.ReadToEnd()

	$errorStream = $process.StandardError
	$error = $errorStream.ReadToEnd()

	if ($error.Length -ne 0) {
		write-host $error.ToString() -ForegroundColor Red
	}

	# Shutdown async read events
	$exitCode = $process.ExitCode
	$process.Close()

	if($exitCode -ne 0) {
		throw "$FilePath $Arguments --> failed with exit code $exitCode"
	}

	return $output
}
$dir = Split-Path $MyInvocation.MyCommand.Path -Parent

. (Join-Path (Split-Path $MyInvocation.MyCommand.Path) Common.ps1)
. (Join-Path (Split-Path $MyInvocation.MyCommand.Path) SourceControl.ps1)

function GetModuleFileConfig {
	[CmdletBinding()]
	param(
	)

	$scriptsConfigPath = Join-Path $dir '..\..\scripts.json'

	Write-Verbose "Reading JSON configuration from '$($scriptsConfigPath)'..."
	ConvertFrom-Json ([system.io.file]::ReadAllText($scriptsConfigPath)) | Write-Output
}

function GetScriptFiles {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory=$true, HelpMessage="The names of the modules to include in the combined script.")]
		[string[]]$Modules
	)

	$moduleFiles = GetModuleFileConfig

	$files = @()
	$Modules | %{
		$moduleName = $_.ToLower().Replace("_", "-");
		Write-Verbose "Processing module '$($moduleName)'..."
		$isExtension = @('dotnet', 'msajax', 'jquery-msajax') -contains $moduleName
		if ($isExtension) {
			$moduleDir = Join-Path 'src\extensions' $moduleName
		}
		else {
			$moduleDir = Join-Path 'src\base' $moduleName
		}
		Write-Verbose "Source directory is '$($moduleDir)'."
		$moduleFiles.$_ | %{
			Write-Verbose "Searching for file '$($_)'..."
			$filePath = Join-Path $moduleDir "$_.js"
			Write-Verbose "File path is '$($filePath)'."
			$files += $filePath
		}
	}

	return $files
}

function GetScriptSourceText {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory=$true, HelpMessage="The names of the modules to include in the combined script.")]
		[string[]]$Modules,

		[Parameter(Mandatory=$false, HelpMessage="The namespaces that the script will export.")]
		[string[]]$Namespaces,

		[Parameter(Mandatory=$false, HelpMessage="Optional text to include at the beginning of the file.")]
		[string]$BannerText,

		[Parameter(Mandatory=$false, HelpMessage="Optional text to include at the end of the file.")]
		[string]$FooterText
	)

	Write-Verbose "Compiling list of files to include..."
	$files = GetScriptFiles -Modules $Modules

	if ($BannerText) {
		$hasWrittenToFile = $true
		$BannerText | Write-Output
	}

	if ($Namespaces -and $Namespaces.Count -gt 0) {
		if ($hasBanner) {
			Write-Verbose "Appending namespaces to banner text..."
			"" | Write-Output
		}
		else {
			Write-Verbose "Generating banner text for namespaces..."
		}

		"window.ExoWeb = {};" | Write-Output

		$hasWrittenToFile = $true

		$Namespaces | %{
			Write-Verbose "Adding namespace '$($_)'."
			"window.ExoWeb.$_ = {};" | Write-Output
		}

		"" | Write-Output
	}

	Write-Verbose "Starting IIFE..."
	"(function(jQuery) {" | Write-Output

	$files | %{
		"" | Write-Output

		# Get the name of the directory that the file resides in.
		$namespaceComponent = Split-Path (Split-Path $_ -Parent) -Leaf

		Write-Verbose "Folder is '$($namespaceComponent)'."

		$namespace = $null

		if ($namespaceComponent -eq "core") {
			$namespace =  "ExoWeb"
		}
		elseif ( $namespaceComponent -eq "ui") {
			$namespace =  "ExoWeb.UI"
		}
		elseif ( $namespaceComponent -eq "dotnet") {
			$namespace =  "ExoWeb.DotNet"
		}
		elseif ($namespaceComponent -ne "msajax" -and $namespaceComponent -ne "jquery-msajax") {
			$namespace =  "ExoWeb." + $namespaceComponent.Substring(0, 1).ToUpper() + $namespaceComponent.Substring(1)
		}

		Write-Verbose "Namespace is '$($namespace)'."

		Write-Verbose "Full file name is '$($_)'."

		$fileName = Split-Path $_ -Leaf
		Write-Verbose "File name is '$($fileName)'."

		$moduleName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
		Write-Verbose "Module name is '$($moduleName)'."

		if ($namespace) {
			$modulePrefix = $namespace + "."
		}
		else {
			$modulePrefix = ""
		}

		# Add "region" header and "underline".
		"`t// #region " + $modulePrefix + $moduleName | Write-Output
		"`t//////////////////////////////////////////////////" | Write-Output
		"" | Write-Output

		$fullFilePath = Resolve-Path (Join-Path (Join-Path $dir '..\..') $_)

		$previousLineRemoved = $false
		$previousLineWasWhitespace = $true
		foreach ($line in (Get-Content $fullFilePath)) {
			$previousLineWasWhitespace = $false
			if ($line -match "(^|`n)[ \t]*('use strict'|""use strict"");?\s*$") {
				# Skip "use strict" statements.
				Write-Verbose "Ignoring use strict statement."
				$previousLineRemoved = $true
			}
			elseif ($line -match "^\s*exports\.(.*\s*=\s*.*;)\s*\/\/\s*IGNORE$") {
				# Skip "// IGNORE" export statements.
				Write-Verbose "Ignoring export due to 'IGNORE' comment."
				$previousLineRemoved = $true
			}
			elseif ($line -match "^\s*\/\/\/\s*\<reference\s") {
				# Skip reference file comments.
				Write-Verbose "Ignoring reference comment."
				$previousLineRemoved = $true
			}
			elseif ($line -match "^(var [A-Za-z_$][A-Za-z_`$0-9]* = )?require\(") {
				# Skip require statements.
				Write-Verbose "Ignoring require statement."
				$previousLineRemoved = $true
			}
			elseif ($line -match "^\s*$") {
				if ($previousLineRemoved) {
					Write-Verbose "Ignoring empty line because previous line was ignored."
					# Skip whitespace following a removed line.
					$previousLineRemoved = $true
				}
				else {
					# Do not manipulate whitespace-only lines.
					Write-Verbose "Including whitespace-only line."
					$line | Write-Output
					$previousLineRemoved = $false
					$previousLineWasWhitespace = $true
				}
			}
			elseif ($line -match "^\s*exports\.([^=]*\s*=)") {
				#Write-Verbose $line
				"`t" + ($line -replace "^\s*exports\.([^=]*\s*=)", ($modulePrefix + "`$1")) | Write-Output
				$previousLineRemoved = $false
			}
			else {
				#Write-Verbose $line
				"`t" + $line | Write-Output
				$previousLineRemoved = $false
			}
		}

		if (!$previousLineWasWhitespace -and !$previousLineRemoved) {
			Write-Verbose "Last line was not whitespace and was not removed, so write a new line at the end of the file's contents."
			"" | Write-Output
		}

		# Add "end region" footer
		"`t// #endregion" | Write-Output
	}

	Write-Verbose "Ending IIFE..."
	"})(window.ExoJQuery || jQuery);" | Write-Output

	if ($FooterText) {
		Write-Verbose "Appending footer text..."
		$FooterText | Write-Output
	}
}

$dir = Split-Path $MyInvocation.MyCommand.Path -Parent

function ShouldBuild {
	[CmdletBinding()]
	param(
		[string]$SourceRoot,
		[string]$DestinationPath
	)

	return $true
}

function CheckoutFile {
	[CmdletBinding()]
	param(
		[Parameter(Mandatory=$true, HelpMessage="The file to check out for edit.")]
		[string]$Item
	)

	Write-Verbose "No checkout needed."
}

# Override with specific provider(s) if they exist
Get-ChildItem $dir | ? { $_.Name -match "^.+SourceControl\.ps1$" } | %{
	Write-Verbose "Loading '$($_.Name)'..."
	. $_.FullName
}

[CmdletBinding()]
param(
	[Parameter(Mandatory=$false, HelpMessage="Whether to force build the file even if no source files have changed.")]
	[switch]$Force
)

$dir = Split-Path $MyInvocation.MyCommand.Path -Parent

& (Join-Path $dir 'Invoke-JavaScriptBuild.ps1') -Modules core,model,mapper,ui,view,jquery_MsAjax,dotNet,msajax -Namespaces Model,Mapper,UI,View,DotNet -DestinationPath ..\..\dist\exoweb-msajax.js -Force:$Force -ErrorAction Stop
& (Join-Path $dir 'Invoke-JavaScriptBuild.ps1') -Modules core,model,mapper,ui,view,dotNet,msajax -Namespaces Model,Mapper,UI,View,DotNet -DestinationPath ..\..\dist\exoweb-msajax-nojquery.js -Force:$Force -ErrorAction Stop
& (Join-Path $dir 'Invoke-JavaScriptBuild.ps1') -Modules jquery_MsAjax -DestinationPath ..\..\dist\jquery.exoweb-msajax.js -BannerText "// jquery plugin for msajax helper`r`n//////////////////////////////////////////////////" -Force:$Force -ErrorAction Stop

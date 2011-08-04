
$category = "ExoWeb"

# delete the existing category if it exists
if([System.Diagnostics.PerformanceCounterCategory]::Exists($category)) {
	[System.Diagnostics.PerformanceCounterCategory]::Delete($category)
}

# define performance counters
"Creating performance counters:"

$ccdType = 'System.Diagnostics.CounterCreationData'
$counters = New-Object System.Diagnostics.CounterCreationDataCollection

$ignore = $counters.Add( (New-Object $ccdType `
	"Requests",
	"Total number of times the ExoWeb has been invoked for data queries, round trips, server events and types. Includes both local and remote queries.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Local Requests",
	"Total number of locally-requested ExoWeb queries. Excludes queries sent by clients to the ExoWeb web service.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Requests",
	"Total number of times the ExoWeb web service has been invoked for data queries, round trips and server events. Type load requests are also included in this number.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Bytes In",
	"Total number of bytes sent to the ExoWeb web service for data queries, round trips and server events.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Change Log Actions In",
	"Total change log entries sent to the ExoWeb web service during data queries, round trips and server events.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Request Change Log Actions Out",
	"Total change log entries sent from the ExoWeb web service during data queries, round trips and server events.  Includes both local and remote queries.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Local Request Change Log Actions Out",
	"Total change log entries sent from locally-requested ExoWeb queries.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Change Log Actions Out",
	"Total change log entries sent from the ExoWeb web service during data queries, round trips and server events.",
	NumberOfItems32) );
	
$ignore = $counters.Add( (New-Object $ccdType `
	"Request Instances Out",
	"Total instances sent from the ExoWeb web service during data queries, round trips and server events.  Includes both local and remote queries.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Local Request Instances Out",
	"Total instances returned from locally-requested ExoWeb queries.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Instances Out",
	"Total instances sent from the ExoWeb web service during data queries, round trips and server events.",
	NumberOfItems32) );
	
$ignore = $counters.Add( (New-Object $ccdType `
	"Request Conditions Out",
	"Total conditions sent from the ExoWeb web service during data queries, round trips and server events.  Includes both local and remote queries.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Local Request Conditions Out",
	"Total conditions returned from locally-requested ExoWeb queries.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Conditions Out",
	"Total conditions sent from the ExoWeb web service during data queries, round trips and server events.",
	NumberOfItems32) );
	
$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Types Out",
	"Total types (metadata) sent from the ExoWeb web service.",
	NumberOfItems32) );
	
	
$counters | foreach { 
	"  " + $category + " > " + $_.CounterName
}

# save
$ignore = [System.Diagnostics.PerformanceCounterCategory]::Create($category, "", [Diagnostics.PerformanceCounterCategoryType]::MultiInstance, $counters); 

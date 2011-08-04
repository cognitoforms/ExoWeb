
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
	"Total number of times the ExoWeb has been invoked for data queries, round trips and server events. Includes both local and remote queries.  Type load requests and error log requests are not included in this number.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Local Requests",
	"Total number locally-requested ExoWeb queries. Excludes queries sent by clients to the ExoWeb web service.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Local Requests",
	"Total number of times the ExoWeb web service has been invoked for data queries, round trips and server events. Type load requests and error log requests are not included in this number.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Bytes In",
	"Total number of bytes sent to the ExoWeb web service for data queries, round trips and server events.  Type load requests and error log requests are not included in this number.",
	NumberOfItems32) );

$ignore = $counters.Add( (New-Object $ccdType `
	"Remote Request Change Log Actions In",
	"Total change log entries sent to the ExoWeb web service during data queries, round trips and server events.  Type load requests and error log requests are not included in this number.",
	NumberOfItems32) );

$counters | foreach { 
	"  " + $category + " > " + $_.CounterName
}

# save
$ignore = [System.Diagnostics.PerformanceCounterCategory]::Create($category, "", [Diagnostics.PerformanceCounterCategoryType]::MultiInstance, $counters); 

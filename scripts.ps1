# Number of files in each folder
Get-ChildItem . -Directory|
ForEach-Object{
   [pscustomobject]@{
       FullName  = $_.Name
       FileCount = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object).Count
   }
}  | Where-Object{$_.FileCount -gt 100} | Sort-Object FileCount -Descending

# move folder
$folder=""
$destination=""
Get-ChildItem $folder -Recurse | Move-Item -Destination "${destination}\${folder}" 


# split folder
$destination="C:\pst\AHermans-Janua\AHERMANS-JANUARY312022.PST\Deleted Items"
Get-ChildItem . -r |
Foreach -Begin {$i = $j = 0} -Process {
    if ($i++ % 4000 -eq 0) {
        $dest = "$destination-$j"
        md $dest
        $j++
    }
    Move-Item $_ $dest
}
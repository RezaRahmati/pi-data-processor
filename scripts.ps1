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


Get-ChildItem '.' -R -Filter *.zip | ForEach-Object {
     Expand-Archive $_.FullName "$($_.DirectoryName)/$($_.Basename)" -Force
     Remove-Item $_.FullName
}



 Get-ChildItem '.' -recurse | where-object {$_.length -gt 10*1024*1024} | Sort-Object length | ft name, length -auto

 get-childitem '.' -Recurse -include *.exe  | foreach ($_) {remove-item $_.fullname}

robocopy .\ c:\temp *.cs,*.html,*.js,*.config,*.sln,*.csproj, /s

Get-ChildItem .\ -include bin,obj -Recurse | ForEach-Object ($_) { Remove-Item $_.FullName -Force -Recurse }

$sourceDir = 'c:\bnn'
$targetDir = 'c:\bnn-result\'
Get-ChildItem $sourceDir -filter "*cmor*" -recurse | `
    foreach{
        $targetFile = $targetDir + $_.FullName.SubString($sourceDir.Length);
        New-Item -ItemType File -Path $targetFile -Force;
        Copy-Item $_.FullName -destination $targetFile
    }
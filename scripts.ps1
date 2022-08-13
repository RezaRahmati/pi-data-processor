# Number of files in each folder
Get-ChildItem . -Directory|
ForEach-Object{
   [pscustomobject]@{
       FullName  = $_.Name
       FileCount = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object).Count
   }
}  | Where-Object{$_.FileCount -gt 100} | Sort-Object FileCount -Descending

Get-ChildItem . -Directory|
ForEach-Object{
   [pscustomobject]@{
       FullName  = $_.Name
       FileCount = (Get-ChildItem $_.FullName -Recurse -File | Where-Object{$_.length -gt 100000} | Measure-Object).Count
   }
} | Sort-Object FileCount -Descending

Get-ChildItem . -Directory|
ForEach-Object{
   [pscustomobject]@{
       FullName  = $_.Name
       FileCount = (Get-ChildItem $_.FullName -Recurse -File -Exclude *.exe,*.dll,*.msi,*.mov,*.mp3,*.mp4,*.pst,*.avi,*.m4a,*.zoom,*.wav,*.lnk,*.ico | Where-Object{$_.length -gt 100000} | Measure-Object).Count
   }
} | Sort-Object FileCount -Descending

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
    
 Unique files
 (Get-ChildItem -Recurse -File| Get-FileHash | Sort-Object -Property hash | Select-Object hash -Unique ).Count
 
 
Clean up
Get-ChildItem -recurse -filter __macosx | Remove-Item -Force -Confirm:$false
Get-ChildItem -recurse -filter .DS_Store | Remove-Item -Force -Confirm:$false
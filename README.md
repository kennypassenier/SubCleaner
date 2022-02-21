# SubCleaner

Attempts to remove all URL's from .SRT files.
Add your directories into the "directories" array and run "node ./index.js".
It will recursively find all .SRT files within each subdirectory. 

Saves processed files into a local sqlite database. Only new files will be processed. 
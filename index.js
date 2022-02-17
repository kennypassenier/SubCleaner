const {default: srtParser2 } = require("srt-parser-2");
const urlRegex = require("url-regex");
const cliProgress = require('cli-progress');
const fs = require("fs").promises;

// We use the processedSymbol as a tag to see if we have
// already previously parsed this file
// saving us valuable time and CPU
const processedSymbol = "ĸ" // UTF-8 c4b8
const parser = new srtParser2();
// const directories = ["E:/Projects/SubCleaner/test"];
const directories = ["D:/Series", "D:/Films"];

async function main(){
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  let amountOfUrls = 0;
  let srtFiles = [];
  // We have 2 folders which we need to scan
  // They are both in the directories constant
  // We need to iterate over both of them and seek every .srt file within
  for(let directory of directories){
    newFiles = await findSrtFiles(directory);  
    srtFiles = [...srtFiles,  ...newFiles];  
  }
  // Now that we have all the relevant files we want to examine
  // We can loop through every one of them and see if there are
  // lines containing a URL

  progressBar.start(srtFiles.length, 0);
  for(let filePath of srtFiles){
    amountOfUrls += await removeURL(filePath);
    progressBar.increment(1);
    progressBar.updateETA();
  }
  progressBar.stop();
  console.log("Finished");
  console.log(`removed ${amountOfUrls} URL's`);

}

async function findSrtFiles(dirName){
  // This function recursively scans directories and adds every srt file
  // to an array, which it returns at the end
  let files = [];
  const items = await fs.readdir(dirName, {withFileTypes: true});

  for(const item of items){
    if(item.isDirectory()){
        files = files.concat(await findSrtFiles(`${dirName}/${item.name}`));
    }
    else{
      if(item.name.endsWith(".srt")){
        files.push(`${dirName}/${item.name}`);
      }
    }
  }
  return files;
}

async function removeURL(filePath){
  let amountOfUrls = 0;
  try {
    // Load text file into array
    const data = await fs.readFile(filePath, "utf-8");
    try {
      // Parse text file into json
      const lines = parser.fromSrt(data);
      let newLines = [];
      // Iterate over json
      lines.forEach((line, index) => {
        // Check if this file has already been processed
        if(index === 0){
          if(line.text.startsWith(processedSymbol)){
            // Break out of the loop 
            return 0;
          }
          else{
            line.text = `${processedSymbol} ${line.text}`;
          }
        }
        // Check if .text contains an URL
        if(urlRegex({strict:false}).test(line.text)){
          // Replace the text with a single space
          // Avoids errors in some video players and
          // we don't have to re-enumerate every line
          const newObject = {
            id: line.id,
            startTime: line.startTime,
            endTime: line.endTime,
            text: " ",
          }
          if(index === 0){
            newObject.text = processedSymbol;  
          }
          newLines.push(newObject);  
          amountOfUrls++;
        }
        else{
          newLines.push(line);
        }
      });     
      try {
        // Every line with an URL is now replaced
        // We should parse the data back into srt format
        // And add it to the file
        const newData = await parser.toSrt(newLines);        
        try {
          await fs.writeFile(filePath, newData);          
        } catch (error) {
          console.error("Error while trying to write to file");
          console.error(filePath);
        }        
      } catch (error) {
        console.error("Error trying to parse data into SRT format");
        console.error(filePath);
      }
    } catch (error) {
      console.error("Problem parsing the SRT data");
      console.error(filePath);
    }
  } catch (error) {
    console.error("There was a problem reading this file");
    console.error(filePath);
  }
  return amountOfUrls;
}

main();
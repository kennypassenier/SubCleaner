const {default: srtParser2 } = require("srt-parser-2");
const urlRegex = require("url-regex");
const fs = require("fs").promises;

const parser = new srtParser2();
const directories = ["D:/Series", "D:/Films", "E:/Series 2", "E:/Films 2"];

async function main(){
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
  for(let filePath of srtFiles){
    amountOfUrls += await removeURL(filePath);
  }
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
  // Load text file into array
  const data = await fs.readFile(filePath, "utf-8");
  // Parse text file into json
  const lines = parser.fromSrt(data);
  let newLines = [];
  // Iterate over json
  for(let line of lines){
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
      newLines.push(newObject);  
      amountOfUrls++;
    }
    else{
      newLines.push(line);
    }
  } 
  // Every line with an URL is now replaced
  // We should parse the data back into srt format
  // And add it to the file
  const newData = await parser.toSrt(newLines);
  await fs.writeFile(filePath, newData);
  return amountOfUrls;
}

main();
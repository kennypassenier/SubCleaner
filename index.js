require("dotenv").config();
const {default: srtParser2 } = require("srt-parser-2");
const urlRegex = require("url-regex");
const cliProgress = require('cli-progress');
const { Model, DataTypes, Sequelize } = require("sequelize");
const fs = require("fs").promises;
const sequelize = new Sequelize(process.env.DBNAME, process.env.DBUSER, process.env.DBPASSWORD, {
  host: process.env.DBHOST,
  dialect: "mysql",
  logging: false,
});

class SubFile extends Model{}

SubFile.init({
  // Model attributes are defined here
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'SubFile' // We need to choose the model name
});
const parser = new srtParser2();
// const directories = ["E:/Projects/SubCleaner/test"];
const directories = ["D:/Series", "D:/Films"];

async function main(){


  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    await SubFile.sync(); // Creates the DB Table if it doesn't exist
    
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
    // We now compare every filename to the ones existing in our database
    // Load all files from our DB
    srtFiles = await filterEntries(srtFiles);
    // Now that we have all the relevant files we want to examine
    // We can loop through every one of them and see if there are
    // lines containing a URL
  
    progressBar.start(srtFiles.length, 0);
    for(let filePath of srtFiles){
      amountOfUrls += await removeURL(filePath);
      progressBar.increment(1);
    }
    progressBar.stop();
    console.log("Finished");
    console.log(`removed ${amountOfUrls} URL's`);
    console.log('Closing connection to database');
    await sequelize.close()
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }





}

// Returns an array with filenames that are NOT in our DB already
async function filterEntries(files){
  const dbFiles = await SubFile.findAll();
  for(let dbFile of dbFiles){
    // If dbFile is found in files, it should get removed
    // from the array
    const itemIndex = files.indexOf(dbFile.dataValues.path);
    if( itemIndex !== -1){
      files.splice(itemIndex, 1);
    }
  }
  return files;
  
}

// Returns array with all filenames
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
// Returns number of files that were edited
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
      });     
      try {
        // Every line with an URL is now replaced
        // We should parse the data back into srt format
        // And add it to the file
        const newData = await parser.toSrt(newLines);        
        try {
          await fs.writeFile(filePath, newData);
          // The file has been rewritten so we can add the path to our DB
          // to prevent having to do this operation again
          try {
            const newDBEntry = await SubFile.create({
              path: filePath,
            });
            // console.log(newDBEntry.id);
            // console.log(newDBEntry.path);
          } catch (error) {
            console.error("Error while trying to put filepath into DB");
            console.error(filePath);
          }       
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
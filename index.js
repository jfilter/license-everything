const checker = require("license-checker");
const fs = require("fs");

const args = process.argv.slice(2);
const source = args[0];
const dest = args[1];
const ignore = args[2];

checker.init(
  {
    start: source
  },
  function(err, json) {
    if (err) {
      console.error("could get data from license-checker: " + err);
    } else {
      processJson(json, ignore).then(data => {
        const json = JSON.stringify(data);
        fs.writeFile(dest, json, "utf8", () => true);
      });
    }
  }
);

function checkIsFile(fullPath) {
  return new Promise((resolve, reject) => {
    fs.lstat(fullPath, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats.isFile());
      }
    });
  });
}

// The license file for license-checker often returns the README so let's find the real file.
// We just look thourh the filder that have a 'license' in their filename.
function fixLicenseFile(path) {
  return new Promise((resolve, reject) => {
    const lastIndex = path.lastIndexOf("/");
    const choppedPath = path.substring(0, lastIndex);

    // chop of rest
    fs.readdir(choppedPath, (err, files) => {
      Promise.all(
        files.map(async file => {
          const fullPath = choppedPath + "/" + file;
          const isFile = await checkIsFile(fullPath);
          if (isFile && file.toLowerCase().includes("license")) return fullPath;
          else return null;
        })
      )
        .then(x => {
          const filterd = x.filter(xx => xx !== null);
          if (filterd.length === 0) reject("not found");
          else resolve(filterd[0]);
        })
        .catch(err => console.error(err));
    });
  });
}

function readFileIntoString(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });
}

async function processJson(json, ignore) {
  const results = await Promise.all(
    Object.keys(json)
      .filter(x => !x.contains(ignore))
      .map(async k => {
        const v = json[k];
        const publisher = v.publisher ? ` by ${v.publisher}` : "";
        const email = v.email ? ` (${v.email})` : "";
        const repository = v.repository ? `Repository: ${v.repository} ` : "";
        const url = v.url ? `Url: ${v.url} ` : "";
        const licenses = ` licensed under ${v.licenses}. `;
        let text = [k, publisher, email, licenses, repository, url].join("");

        if (v.licenseFile) {
          try {
            const fixedLicenseFile = await fixLicenseFile(v.licenseFile);
            const fileAsText = await readFileIntoString(fixedLicenseFile);
            text += fileAsText + "\n";
          } catch (error) {
            // console.error(error);
          }
        }
        return text;
      })
  );
  return results;
}

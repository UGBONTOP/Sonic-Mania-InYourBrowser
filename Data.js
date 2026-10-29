var Module = typeof Module != 'undefined' ? Module : {};

if (!Module['expectedDataFileDownloads']) Module['expectedDataFileDownloads'] = 0;
Module['expectedDataFileDownloads']++;
(() => {
  var isPthread = typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD;
  var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
  if (isPthread || isWasmWorker) return;
  var isNode = globalThis.process && globalThis.process.versions && globalThis.process.versions.node && globalThis.process.type != 'renderer';

  async function loadPackage(metadata) {
    var PACKAGE_NAME = 'Data.data';
    var NUM_PARTS = 14;
    var BASE_URL = 'https://fastly.jsdelivr.net/gh/UGBONTOP/Sonic-Mania-InYourBrowser@main/';

    async function fetchPart(partIndex) {
      var partName = `Data.data.part${partIndex}`;
      var url = BASE_URL + partName;

      if (isNode) {
        var contents = require('fs').readFileSync(partName);
        return new Uint8Array(contents);
      }

      Module['setStatus'] && Module['setStatus'](`Downloading part ${partIndex + 1}/${NUM_PARTS}...`);

      var response = await fetch(url, {
        cache: 'force-cache',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.url}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    }

    async function fetchInBatches(limit = 3) {
      const results = new Array(NUM_PARTS);
      let nextIndex = 0;
      let active = 0;

      return await new Promise((resolve, reject) => {
        const launch = () => {
          if (nextIndex >= NUM_PARTS && active === 0) {
            resolve(results);
            return;
          }

          while (active < limit && nextIndex < NUM_PARTS) {
            const index = nextIndex++;
            active++;

            fetchPart(index)
              .then((part) => {
                results[index] = part;
              })
              .catch(reject)
              .finally(() => {
                active--;
                launch();
              });
          }
        };

        launch();
      });
    }

    async function fetchAndAssemble() {
      const parts = await fetchInBatches(3);

      let totalSize = 0;
      for (const part of parts) {
        totalSize += part.length;
      }

      const assembled = new Uint8Array(totalSize);
      let offset = 0;

      for (const part of parts) {
        assembled.set(part, offset);
        offset += part.length;
      }

      Module['setStatus'] && Module['setStatus']('Assembling Data.data...');
      return assembled.buffer;
    }

    async function runWithFS(Module) {
      function assert(check, msg) {
        if (!check) throw new Error(msg);
      }

      for (var file of metadata['files']) {
        Module['addRunDependency'](`fp ${file['filename']}`);
      }

      async function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData ' + arrayBuffer.constructor.name);
        var byteArray = new Uint8Array(arrayBuffer);
        for (var file of metadata['files']) {
          var name = file['filename'];
          var data = byteArray.subarray(file['start'], file['end']);
          Module['FS_createDataFile'](name, null, data, true, true, true);
          Module['removeRunDependency'](`fp ${name}`);
        }
        Module['removeRunDependency']('datafile_Data.data');
      }

      Module['addRunDependency']('datafile_Data.data');
      if (!Module['preloadResults']) Module['preloadResults'] = {};
      Module['preloadResults'][PACKAGE_NAME] = { fromCache: false };

      const assembled = await fetchAndAssemble();
      processPackageData(assembled);
    }

    if (Module['calledRun']) {
      runWithFS(Module);
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module['preRun'].push(runWithFS);
    }
  }

  loadPackage({
    "files": [{ "filename": "/Data.rsdk", "start": 0, "end": 208368695 }],
    "remote_package_size": 208368695
  });
})();

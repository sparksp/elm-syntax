const request = require('request');

var packages = [];
var packageVersions = [];
var modules = [];


const charsPerMilli = [];
const Elm = require('./parse');

function handleModules(artifact, version, cb) {
  const mod = modules.shift();
  if (!mod) {
    cb();
    return;
  }


  const fileName= mod.replace(new RegExp('\\.', 'g'), '/');

  request(`https://raw.githubusercontent.com/${artifact.name}/${version}/src/${fileName}.elm`, function(err, res, body) {
    if (res.statusCode != 200) {
      console.log(`> Could not load ${artifact.name}@${version} | ${mod}`);
      cb();
      return;
    }
    const name = `${artifact.name}@${version} | ${mod}`;
    const before = new Date().getTime();
    Elm.Elm.ParseTest.init({ flags : {
      body: body,
      name: name
    }});
    const after = new Date().getTime();
    const millis = after - before
    charsPerMilli.push(body.length / millis);
    handleModules(artifact, version, cb);
  })

}

function analyseVersion(artifact, version, definition, cb) {
  modules = [];
  if (!Array.isArray(definition['exposed-modules'])) {
    Object.keys(definition['exposed-modules']).forEach(key => {
      modules = modules.concat(definition['exposed-modules'][key]);
    });
  } else {
    modules = definition['exposed-modules'];
  }
  handleModules(artifact, version, cb)
}

function handleNextVersion(next, cb) {
  const nextVersion = packageVersions.shift();
  if (!nextVersion) {
    cb();
    return;
  }

  request(`https://github.com/${next.name}/raw/${nextVersion}/elm.json`, function(err, res, body) {
    if (res.statusCode !== 200) {
      console.log(`> ${next.name}@${nextVersion} Could not fetch elm.json`);
      handleNextVersion(next, cb);
      return;
    }

    analyseVersion(next, nextVersion, JSON.parse(body), function() {
      handleNextVersion(next, cb);
    });
  });

}

function analysePackage(next, cb) {
  packageVersions = next.versions;

  handleNextVersion(next, function() {
    cb();
    return;
  })
}

function handleNextPackage() {
  const next = packages.shift();

  if (!next) {
    const averageCharsPerMilli = charsPerMilli.reduce((a, b ) => a + b, 0) / charsPerMilli.length;
    console.log("Average char per milli:",averageCharsPerMilli);
    return;
  }

  analysePackage(next, function() {
    handleNextPackage();
  });
}


request('https://package.elm-lang.org/search.json', function(err, response, body) {
  packages = JSON.parse(body);

  handleNextPackage()
})

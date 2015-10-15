'use strict';

let appConfig, packageVersion, swaptimer;

const HOT_SWAP_INTERVAL = 5000, //ms
      fsp = require('fs-promise'),
      utils = require('utils'),
      jsxEngine = require('./jsx-engine'),
      reload = require('require-reload')(require), // see https://github.com/fastest963/require-reload
      cwd = process.cwd();

const applyVersion = () => {
    return fsp.readJson(cwd+'/package.json').then(packageConfig => {
        const changed = (packageConfig.version!==packageVersion);
        packageVersion = packageConfig.version;
        return changed;
    });
};

const setRoutes = server => {
    let prefix = '/versions/'+packageVersion;
    const routes = reload(cwd+prefix+'/routes.js')(server),
          serverConnection = server.root;
    routes.push({
        method: 'GET',
        path: '/{scriptfile}.js',
        handler(request, reply) {
            server.sendFile(cwd+prefix+'/assets/js/'+request.params.scriptfile+'.js', reply);
        }
    });
    routes.push({
        method: 'GET',
        path: '/{cssfile}.css',
        handler(request, reply) {
            server.sendFile(cwd+prefix+'/assets/css/'+request.params.scriptfile+'.css', reply);
        }
    });
    serverConnection.route(routes);
    serverConnection.routes = {
        prefix
    };
    return Promise.resolve();
};

const applyConfig = config => {
    const args = process.argv,
          env = args[2] || 'production';
    appConfig = config;
    appConfig.env = config.environments[env];
    appConfig.env.name = env;
    return Promise.resolve();
};

const setHotswap = server => {
    if (swaptimer) {
        swaptimer.cancel();
    }
    if (appConfig.env.hotswap) {
        swaptimer = utils.later(updateConfig.bind(null, server), HOT_SWAP_INTERVAL, true);
    }
    else {
        swaptimer = null;
    }
    return Promise.resolve(appConfig.env.hotswap);
};

const updateConfig = server => {
    return applyVersion().then(changed => {
        if (changed) {
            return setRoutes(server);
        }
    })
    .catch(err => console.log(err));
};

const initServer = server => {
    let prefix = '/versions/'+packageVersion;
    const serverConnection = server.root;

    serverConnection.connection({
        host: 'localhost',
        port: appConfig.env.port
    });

    server.views({
        engines: {
            html: jsxEngine(envConfig, packageConfig)
        },
        path: cwd+prefix+'/views'
    });

    server.sendFile = (fileName, reply) => {
        console.log('server.sendFile '+fileName);
        reply('ok');
    };

    server.generateView = (viewName, request, reply) => {
        console.log('server.generateView '+viewName);
        reply('ok');
    };

    server.control = (controllerName, request, reply) => {
        console.log('server.control '+controllerName);
        reply('ok');
    };

    return Promise.resolve();
};

const plugin = {
    register(server, options, next) {
        applyVersion()
        .then(applyConfig.bind(null, options))
        .then(initServer.bind(null, server))
        .then(setRoutes.bind(null, server))
        .then(setHotswap.bind(null, server))
        .then(
            () => next(),
            err => {
                console.log(err);
                next();
            }
        );
    }
};

plugin.register.attributes = {
    pkg: require('./package.json')
};

module.exports = plugin;
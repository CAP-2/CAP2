const dns = require('dns');
const net = require('net');
const mysql = require('mysql2');
require('dotenv').config();

const dbHost = process.env.DB_HOST;
const dbPort = Number(process.env.DB_PORT || 16931);

const resolver = new dns.Resolver();
resolver.setServers(
    (process.env.DB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean)
);

const lookupWithPublicDns = (hostname, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    resolver.resolve4(hostname, (resolveError, addresses) => {
        if (!resolveError && addresses && addresses.length > 0) {
            if (options && options.all) {
                callback(null, addresses.map((address) => ({ address, family: 4 })));
                return;
            }
            callback(null, addresses[0], 4);
            return;
        }

        dns.lookup(hostname, options, callback);
    });
};

const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    stream: () => net.connect({
        host: dbHost,
        port: dbPort,
        lookup: lookupWithPublicDns,
    }),
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

module.exports = db;

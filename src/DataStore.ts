import * as Datastore from 'nedb';
import { promises as fsPromises } from "fs";
import * as crypto from 'crypto'; // now is in node default module
import * as path from "path";
import { app } from "electron";

const algorithm = 'aes-256-cbc'; // you can choose many algorithm from supported openssl
const dbFilePath = path.join(process.env.APPDATA, "ElectronNedbIntegration", "users.db");
console.log("db file path is : ", dbFilePath);

function getDataStoreOptions(key: string): Datastore.DataStoreOptions {
    const dataStoreOptions: Datastore.DataStoreOptions = {
        filename: dbFilePath,
        autoload: false,
        timestampData: true,
        corruptAlertThreshold: 0,

        // from plaintext to into cipherText
        afterSerialization(plaintext) {
            // console.log("Inside afterseriliazation - plaintext is ", plaintext);
            const iv = crypto.randomBytes(16);
            const aes = crypto.createCipheriv(algorithm, key, iv);
            let ciphertext = aes.update(plaintext);
            ciphertext = Buffer.concat([iv, ciphertext, aes.final()]);
            return ciphertext.toString('base64');
        },

        // from cipherText to into plainText
        beforeDeserialization(ciphertext) {
            // console.log("Inside before deserilization - cipherText is ", ciphertext);
            const ciphertextBytes = Buffer.from(ciphertext, 'base64')
            const iv = ciphertextBytes.slice(0, 16)
            const data = ciphertextBytes.slice(16)
            const aes = crypto.createDecipheriv(algorithm, key, iv)
            let plaintextBytes = Buffer.from(aes.update(data))
            plaintextBytes = Buffer.concat([plaintextBytes, aes.final()])
            let plaintext = plaintextBytes.toString();
            return plaintext;
        }
    };
    console.log("returning dataStoreOptions");
    return dataStoreOptions;
}

async function loadDb(db: Datastore): Promise<any> {
    return new Promise<void>((resolve, reject) => {
        db.loadDatabase((err: Error) => {
            if (err) {
                console.error("error on loading database -- ", err);
                return reject(err);
            } else {
                console.log("loaded database");
                return resolve();
            }
        });
    });
}

async function createAndLoadDb(key: string): Promise<Datastore> {
    let db: Datastore = new Datastore(getDataStoreOptions(key));
    try {
        await loadDb(db);
        console.log("loaded db. returning it");
        return db;
    } catch (err) {
        console.log("could not load DB. Error is - ", err);
        console.log("deleting users.db file");
        await deleteDbFile(dbFilePath);
        console.log("deleted db file");
        try {
            await loadDb(db);
            return db;
        } catch (error) {
            console.log("could not load DB even after truncating. Error is - ", error);
            process.exit(1);
        }
    }
}

async function deleteDbFile(dbFilePath: string) {
    console.log("deleting db file");
    try {
        await fsPromises.unlink(dbFilePath);
        console.log("db file got deleted successfully.");
    } catch (err) {
        console.error("error in deleting db file - ", err);
        process.exit(1);
    }
}

function getHashOfSecretKey(secretKey: string): string {
    return crypto.createHash('sha256').update(String(secretKey)).digest('base64').substr(0, 32);
}

export async function createDataStore(secretKey: string): Promise<Datastore> {
    let hashOfSecretKey = getHashOfSecretKey(secretKey);
    console.log("hash of secret key is : ", hashOfSecretKey);
    let db: Datastore = await createAndLoadDb(hashOfSecretKey);
    console.log("users.db created successfully");
    return db;
} 
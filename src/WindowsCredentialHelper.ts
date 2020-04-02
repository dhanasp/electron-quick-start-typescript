// import * as logger from 'electron-log';
import * as keytar from 'keytar';

export class WindowsCredentialHelper {
	public async getCredentils(service: string, keys: string[]): Promise<any> {
		return new Promise(async function (resolve, _reject) {
			let promises = [];
			keys.forEach(function (key) {
				if (key) {
					promises.push(keytar.getPassword('ElectronNedb', service + '_' + key));
				}
			});

			Promise.all(promises).then(function (values) {
				let index = 0;
				let creds: Credentil[] = [];
				keys.forEach(function (key) {
					creds.push({
						key,
						value: values[index]
					});
					index += 1;
				});

				return resolve(creds);
			});
		});
	}

	public async saveCredentils(service: string, creds: Credentil[]) {
		creds.forEach(function (cred) {
			if (cred.key) {
				if (cred.value) {
					keytar.setPassword('ElectronNedb', service + '_' + cred.key, cred.value);
				} else {
					keytar.deletePassword('ElectronNedb', service + '_' + cred.key);
				}
			}
		});
	}
}

export interface Credentil {
	key: string;
	value: string;
}

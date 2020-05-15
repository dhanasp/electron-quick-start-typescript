import * as keytar from 'keytar';

export class WindowsCredentialHelper {

	public async getCredentials(service: string, keys: string[]): Promise<Credential[]> {
		return new Promise(function (resolve, _reject) {
			let promises = [];
			keys.forEach(function (key) {
				if (key) {
					promises.push(keytar.getPassword('ElectronNedb', service + '_' + key));
				}
			});
			Promise.all(promises).then(function (values) {
				let index = 0;
				let creds: Credential[] = [];
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

	public async saveCredentials(service: string, creds: Credential[]) {
		let operationsArray: Promise<any>[] = [];
		creds.forEach((cred: Credential, _index, _arr) => {
			if (cred.key) {
				if (cred.value) {
					operationsArray.push(keytar.setPassword('ElectronNedb', service + '_' + cred.key, cred.value));
				} else {
					operationsArray.push(keytar.deletePassword('ElectronNedb', service + '_' + cred.key));
				}
			}
		});
		await Promise.all(operationsArray);
	}
}

export interface Credential {
	key: string;
	value: string;
}

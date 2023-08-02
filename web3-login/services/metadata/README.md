### Setting Data
```sh
$ curl -X GET --data '{ "verifier": "test", "verifier_id": "test@gmail.com", "data": "123", "signature": "SignatureHexString" }' localhost:5051/set
{"message":"success"}
```

### Getting Data
```sh
$ curl -X GET --data '{ "verifier": "test", "verifier_id": "test@gmail.com" }' localhost:5051/get
{"message":"123"}
```

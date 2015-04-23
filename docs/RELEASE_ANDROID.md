The following outlines the steps for getting Fieldtrip Open app released on play store.

### Create a private key

```
$ keytool -genkey -v -keystore <my-release-key>.keystore
-alias <alias_name> -keyalg RSA -keysize 2048 -validity 10000
```

Then you need to store it somewhere and let Fieldtrip Open know of 
where it is be defining inside the release are of the config file

[keystore configuration](https://github.com/edina/fieldtrip-open/blob/master/etc/config.example#L36)

After that you need to define tags/branches on each cordova, fieldtrip plugin, project and core software. 
This will be defined inside the project.json file of the actual project e.g.

[example project.json](https://github.com/edina/fieldtrip-cobweb-project/blob/master/theme/project.json)

Then you need to go and checkout fieldtrip-open and the project you are using according to the tags/branches
are mentioned inside the project.json.

Next step is to clean, build and release:
```
fab clean
fab deploy_android
fab release_android:beta=False
```


### Use play store console for testers

For this part you are going to need a a signed apk by following the steps above. Then you need to create a 
google group that is going to be your testers and add this community to your app inside the play store console. 

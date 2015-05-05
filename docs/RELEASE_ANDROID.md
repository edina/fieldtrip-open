The following outlines the steps for releasing a Fieldtrip Open app on play store.

### Create a private key

See [Step 1 on Signing Your App Manually](http://developer.android.com/tools/publishing/app-signing.html#signing-manually)

### Config

Update keystore value in the release section of config.ini with location of keystore created above. E.g: [keystore configuration](https://github.com/edina/fieldtrip-open/blob/0.5.2/etc/config.example#L36)

Ensure a tag/branch is defined for core, project and each cordova and fieldtrip plugin in project.json. E.g: [example project.json](https://github.com/edina/fieldtrip-gb/blob/1.5.0/theme/project.json). Do a clean install.

### Perform Release

```
fab release_android:beta=False
```

This creates a signed app and copies apks to machines defined by hosts value in release section of config.ini.

#### Options

* beta - to create release signed with key created above, this must be False.
* email - send email to mailing addresses in email_official in config.ini?
* overwrite - If True, apks will be overwritten on server.

### Use play store console for testers

Create a google group that is going to be your testers and add this community to your app inside the play store console.

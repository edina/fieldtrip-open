The following outlines the steps for getting Fieldtrip Open development environment setup using [Vagrant](http://www.vagrantup.com/).

### Install VirtualBox (with USB support)

[https://www.virtualbox.org/manual/ch02.html](https://www.virtualbox.org/manual/ch02.html)

### Install Vagrant

[http://docs.vagrantup.com/v2/installation/index.html](http://docs.vagrantup.com/v2/installation/index.html)


### Setup VM

```
$ vagrant init gmh04/ftopen32
$ vagrant up
```

### Configure VM for device

Add the following to your Vagrantfile

#### USB support

    config.vm.provider :virtualbox do |vb|
      vb.customize ['modifyvm', :id, '--usb', 'on']
      vb.customize ['usbfilter', 'add', '0', '--target', :id, '--name', 'android', '--vendorid', '<vid>', '--productid', '<pid>']
    end

Where `vid` is the vendor id and `pid` os the product id of the device (run `VBoxManage list usbhost` to determine).

#### Apache

    config.vm.network "forwarded_port", guest: 3232, host: <port>
    
Where `port` is the port you wish to assign the Fieldtrip desktop app.

### Login to VM

```
$ vagrant ssh
```

### Setup git

[https://help.github.com/articles/set-up-git#set-up-git](https://help.github.com/articles/set-up-git#set-up-git)

```
$ git clone https://github.com/edina/fieldtrip-open.git
```

or with write access:

```
$ git clone git@github.com:edina/fieldtrip-open.git
```

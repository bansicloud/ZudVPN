import React, { Component } from 'react'
import { Button, Dimensions, Linking, Platform, Text, TouchableOpacity, View } from 'react-native'
import SafariView from 'react-native-safari-view'
import AsyncStorage from '@react-native-community/async-storage'
//import RNNetworkExtension from 'react-native-network-extension'
import Deploy from './../../providers/DigitalOcean/deploy'
import StaticServer from 'react-native-static-server'
import RNFS from 'react-native-fs'
import VPNMobileConfig from './../../vpn.mobileconfig'
import DownloadViaXhr from '../../download-via-xhr';
import notification from '../../notification_core'

const ACCESS_TOKEN_DATA = 'ACCESS_RESPONSE';

class Welcome extends Component {
    constructor(props) {
        super(props)

        this.state = {
            tokenData: null,
            status: 'Disconnected',
            logs: []
        }

        this.staticServer = new StaticServer(8080, RNFS.DocumentDirectoryPath + '/config', {localOnly: true})
    }

    componentDidMount() {
        if (Platform.OS === 'android') {
            Linking.getInitialURL().then(url => {
                this.handleCallback(url)
            })
        } else {
            Linking.addEventListener('url', this.handleCallbackEvent)
        }

        //this.vpnStatusListener = RNNetworkExtension.addEventListener('status', this.networkStatusCallback)

        //this.vpnFailListener = RNNetworkExtension.addEventListener('fail', this.networkFailCallback)

        AsyncStorage.getItem(ACCESS_TOKEN_DATA).then(value => {
            if (value !== null) {
                const tokenData = JSON.parse(value)
                this.setState({ tokenData })
            }
        })
    }

    componentWillUnmount() {
        Linking.removeEventListener('url', this.handleCallbackEvent)

        this.vpnStatusListener.remove()
        // RNNetworkExtension.removeEventListener('status', this.networkStatusCallback)

        this.vpnFailListener.remove()
        // RNNetworkExtension.removeEventListener('fail', this.networkFailCallback)
    }

    networkStatusCallback = status => {
        console.log('newtork status: ', status)
        this.setState({status})
    }

    networkFailCallback = reason => {
        console.log('network fail reason: ', reason)
    }

    handleCallback = (url) => {
        console.log('The callback url received', url)
        let result = url.split('?')[1].split('&').reduce(function (result, item) {
            var parts = item.split('=');
            result[parts[0]] = parts[1];
            return result;
        }, {});

        if (Object.keys(result).length > 0 && result.hasOwnProperty('access_token')) {
            AsyncStorage.setItem(ACCESS_TOKEN_DATA, JSON.stringify(result))
            this.setState({ tokenData: result })
        }

        SafariView.dismiss()
    }

    handleCallbackEvent = (event) => {
        this.handleCallback(event.url)
    }

    installConfig = async (vpnData) => {
        let config = VPNMobileConfig('ZudVPN', vpnData)
        
        await RNFS.mkdir(RNFS.DocumentDirectoryPath + '/config', {NSURLIsExcludedFromBackupKey: true})
            
        let html = DownloadViaXhr(config)

        let html_path = RNFS.DocumentDirectoryPath + '/config/download-via-xhr.html'

        await RNFS.writeFile(html_path, html, 'utf8')

        let url = await this.staticServer.isRunning() ? this.staticServer.origin : await this.staticServer.start()

        SafariView.show({
            url: url + '/download-via-xhr.html',
            fromBottom: true
        }).then(() => {
            this.setState({status: 'Connect'})
            // RNNetworkExtension.connect({
            //     IPAddress: vpnData.ipAddress,
            //     clientCert: vpnData.privateKeyCertificate,
            //     clientCertKey: vpnData.privateKeyPassword
            // })
        })
    }

    triggerVPN = async () => {
        if (this.state.status === 'Connected') {
            console.log('stopping vpn')
            //RNNetworkExtension.disconnect()
        } else {
            this.setState({status:'Connecting'})
            console.log('triggered vpn')
            
            // @TODO SELECT REGION IF NOT SELECTED

            try {
                deploy = new Deploy(this.state.tokenData.access_token, 'fra1', this.setLog)
                let vpnData = await deploy.run()
    
                this.installConfig(vpnData)
    
                // RNNetworkExtension.connect({
                //     IPAddress: vpnData.ipAddress,
                //     clientCert: vpnData.privateKeyCertificate,
                //     clientCertKey: vpnData.privateKeyPassword
                // })
            } catch (e) {
                this.setState({status:'Disconnected'})
                console.warn(e)
                this.setLog('ERROR:', e)
            }
        }
    }

    triggerProviderSelectScreenModal = () => {
        this.props.ProviderSelectScreenModal(this.staticServer)
    }

    setLog = (...message) => {
        notification.log(message)
        const logs = [...notification.logs()]
        this.setState({ logs: logs.reverse() })
    }

    render() {
        const { tokenData, logs } = this.state

        if (tokenData === null) {
            return (
                <View style={{                    
                    flex:1, 
                    alignItems: 'center',
                    position: 'relative',
                    paddingTop: '70%'
                    }}>
                    <View style={{
                        flex: 1,
                        height: Dimensions.get('window').width,
                        width: Dimensions.get('window').width * 2,
                        position: 'absolute',
                        backgroundColor: '#C4DBF6',
                        borderBottomStartRadius: Dimensions.get('window').height,
                        borderBottomEndRadius: Dimensions.get('window').height,
                    }}></View>
                    <Text style={{position: 'absolute', top: 50, color: 'black'}}>Zud VPN</Text>
                    <TouchableOpacity
                        onPress={this.triggerProviderSelectScreenModal}
                        style={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: '#3B8BEB',
                            borderColor: '#E7E3D4',
                            borderColor: 'white',
                            borderWidth: 5,
                            padding: 5,
                            height: 200,
                            width: 200,
                            borderRadius: 400
                        }}
                    >
                        <Text style={{
                            color: 'white', 
                            fontSize: 18
                            }}>Connect</Text>
                    </TouchableOpacity>
                    <Text>
                        Get Started!
                    </Text>
                </View>
            )
        }
        
        let disabled = this.state.status == 'Connecting' || this.state.status == 'Disconnecting';


        let label = this.state.status
        switch (this.state.status) {
            case 'Connected':
                label = 'Disconnect'
                break;
            case 'Disconnected':
                label = 'Connect'
                break;
        }

        return (
            <View style={{
                flex:1,
                alignItems: 'center',
                position: 'relative',
                paddingTop: '70%'
                }}>
                <View style={{
                    flex: 1,
                    height: Dimensions.get('window').width,
                    width: Dimensions.get('window').width * 2,
                    position: 'absolute',
                    backgroundColor: '#C4DBF6',
                    borderBottomStartRadius: Dimensions.get('window').height,
                    borderBottomEndRadius: Dimensions.get('window').height,
                }}></View>
                <Text style={{position: 'absolute', top: 50, color: 'black'}}>Zud VPN</Text>
                <TouchableOpacity
                    disabled={disabled}
                    onPress={this.triggerVPN}
                    style={{
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: '#3B8BEB',
                        borderColor: '#E7E3D4',
                        borderColor: 'white',
                        borderWidth: 5,
                        padding: 5,
                        height: 200,
                        width: 200,
                        borderRadius: 400
                    }}
                >
                    <Text style={{
                        color: 'white', 
                        fontSize: 18
                        }}>{label}</Text>
                </TouchableOpacity>
                <View>
                    <TouchableOpacity onPress={this.props.LogFileViewerScreenModal}>
                        {logs.map((log, index) => <Text key={index}>{log}</Text>)}
                    </TouchableOpacity>
                </View>
            </View>
        )
    }
}

export default Welcome
import React from 'react';
import { Modal, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RazorpayCheckout({ visible, onClose, orderDetails, onSuccess }) {
  if (!visible || !orderDetails) return null;

  // HTML content that loads Razorpay JS SDK
  const razorpayHTML = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fff;}</style>
      </head>
      <body>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          var options = {
            "key": "${orderDetails.key}", 
            "amount": "${orderDetails.amount}", 
            "currency": "INR",
            "name": "CLUB 28",
            "description": "${orderDetails.description}",
            "order_id": "${orderDetails.order_id}",
            "prefill": {
              "contact": "${orderDetails.contact}",
              "email": "${orderDetails.email}"
            },
            "theme": { "color": "#2563eb" },
            "handler": function (response){
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SUCCESS',
                data: response
              }));
            },
            "modal": {
              "ondismiss": function(){
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DISMISS' }));
              }
            }
          };
          var rzp1 = new Razorpay(options);
          window.onload = function(){ rzp1.open(); };
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={{flex:1, backgroundColor:'white'}}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{color:'white', fontWeight:'bold'}}>CANCEL PAYMENT</Text>
        </TouchableOpacity>
        <WebView
          originWhitelist={['*']}
          source={{ html: razorpayHTML }}
          onMessage={(event) => {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'SUCCESS') onSuccess(msg.data);
            else if (msg.type === 'DISMISS') onClose();
          }}
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator size="large" color="#2563eb" style={styles.loader}/>}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeBtn: { backgroundColor: 'red', padding: 15, alignItems: 'center' },
  loader: { position: 'absolute', top: '50%', left: '50%' }
});
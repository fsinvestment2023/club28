import React from 'react';
import { Modal, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RazorpayCheckout({ visible, onClose, orderDetails, onSuccess }) {
  // 🛑 CRITICAL FIX: If data is missing, return nothing (don't crash)
  if (!visible || !orderDetails) return null;

  const options = {
    key: orderDetails.key, 
    amount: orderDetails.amount, 
    currency: "INR",
    name: "CLUB 28",
    description: orderDetails.description,
    order_id: orderDetails.order_id,
    prefill: {
      contact: orderDetails.contact,
      email: orderDetails.email
    },
    theme: { color: "#2563eb" },
    modal: {}
  };

  const razorpayHTML = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fff;}</style>
      </head>
      <body>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          var options = ${JSON.stringify(options)};
          options.handler = function (response){
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SUCCESS', data: response }));
          };
          options.modal.ondismiss = function(){
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DISMISS' }));
          };
          var rzp1 = new Razorpay(options);
          rzp1.on('payment.failed', function (response){
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FAILED', data: response.error }));
          });
          window.onload = function(){ rzp1.open(); };
        </script>
      </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
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
            else if (msg.type === 'FAILED') console.error("Payment Failed:", msg.data);
          }}
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator size="large" color="#2563eb" style={styles.loader}/>}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeBtn: { backgroundColor: '#dc2626', padding: 15, alignItems: 'center', zIndex: 10 },
  loader: { position: 'absolute', top: '50%', left: '50%', marginTop: -20, marginLeft: -20 }
});
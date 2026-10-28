package com.daaleixo.dagames;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The game files live inside the APK, so there is nothing to gain from the
        // WebView HTTP cache. Without this, an updated APK can keep running old
        // JavaScript modules from a previous version.
        WebView webView = getBridge().getWebView();
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
    }
}

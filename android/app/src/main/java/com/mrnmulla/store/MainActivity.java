package com.mrnmulla.store;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Request highest available refresh rate (120Hz on supported devices)
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.preferredRefreshRate = 120f;
        getWindow().setAttributes(params);
    }
}

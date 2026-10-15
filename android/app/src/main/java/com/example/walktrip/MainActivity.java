package com.example.walktrip;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.example.walktrip.pedometer.PedometerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        registerPlugin(PedometerPlugin.class);
    }
}

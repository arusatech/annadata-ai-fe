package ai.annadata.app;

import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.splashscreen.SplashScreenPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(SplashScreenPlugin.class);
    }
}

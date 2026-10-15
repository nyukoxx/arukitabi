package com.example.walktrip.pedometer

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PluginMethod

@CapacitorPlugin(name = "Pedometer")
class PedometerPlugin : Plugin(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepSensor: Sensor? = null
    private var lastSteps: Float = 0f

    override fun load() {
        sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
            lastSteps = event.values[0]
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    @PluginMethod
    fun getSteps(call: PluginCall) {
        call.resolve(
            mapOf("steps" to lastSteps)
        )
    }
}

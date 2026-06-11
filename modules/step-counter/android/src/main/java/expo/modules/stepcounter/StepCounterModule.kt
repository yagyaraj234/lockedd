package expo.modules.stepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.react.native.mmkv.MMKVModule
import java.text.SimpleDateFormat
import java.util.*

class StepCounterModule : Module(), SensorEventListener {
  private val context: Context
    get() = appContext.reactContext ?: throw Exception("No React context")

  private var sensorManager: SensorManager? = null
  private var stepSensor: Sensor? = null
  private var lastStepCount = 0

  override fun definition() = ModuleDefinition {
    Name("StepCounter")

    Function("startListening") {
      sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      if (stepSensor != null) {
        sensorManager?.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI)
      }
    }

    Function("stopListening") {
      if (sensorManager != null && stepSensor != null) {
        sensorManager?.unregisterListener(this, stepSensor)
      }
    }

    AsyncFunction("getTodaySteps") { promise: (Any?) -> Unit ->
      try {
        val steps = readTodaySteps()
        promise(steps)
      } catch (e: Exception) {
        promise(0)
      }
    }

    AsyncFunction("getStepGoal") { promise: (Any?) -> Unit ->
      try {
        val mmkv = MMKVModule.getMMKVInstance() ?: return@AsyncFunction
        val settingsJson = mmkv.decodeString("settings") ?: "{}"
        val goal = settingsJson
          .substringAfter("\"stepGoal\":")
          .substringBefore(",")
          .toIntOrNull() ?: 10000
        promise(goal)
      } catch (e: Exception) {
        promise(10000)
      }
    }

    AsyncFunction("setStepGoal") { goal: Int, promise: (Any?) -> Unit ->
      try {
        val mmkv = MMKVModule.getMMKVInstance() ?: return@AsyncFunction
        val settingsJson = mmkv.decodeString("settings") ?: "{}"
        val updated = settingsJson
          .replace(
            Regex("\"stepGoal\":\\d+"),
            "\"stepGoal\":$goal"
          )
        mmkv.encodeString("settings", updated)
        promise(true)
      } catch (e: Exception) {
        promise(false)
      }
    }
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
      val steps = event.values[0].toInt()
      val today = getTodayString()

      try {
        val mmkv = MMKVModule.getMMKVInstance() ?: return
        val currentData = mmkv.decodeString("stepData") ?: ""
        val currentDate = currentData.substringAfter("\"date\":\"").substringBefore("\"")

        if (currentDate != today) {
          // New day, reset counter
          mmkv.encodeString("stepData", "{\"date\":\"$today\",\"steps\":$steps}")
        } else {
          // Same day, update
          mmkv.encodeString("stepData", "{\"date\":\"$today\",\"steps\":$steps}")
        }
      } catch (e: Exception) {
        // Ignore errors
      }
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
    // Ignore
  }

  private fun readTodaySteps(): Int {
    try {
      val mmkv = MMKVModule.getMMKVInstance() ?: return 0
      val stepData = mmkv.decodeString("stepData") ?: return 0
      val today = getTodayString()

      val date = stepData.substringAfter("\"date\":\"").substringBefore("\"")
      if (date != today) return 0

      return stepData
        .substringAfter("\"steps\":")
        .substringBefore("}")
        .toIntOrNull() ?: 0
    } catch (e: Exception) {
      return 0
    }
  }

  private fun getTodayString(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date())
  }
}

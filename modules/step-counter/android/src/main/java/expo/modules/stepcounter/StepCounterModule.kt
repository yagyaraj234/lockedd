package expo.modules.stepcounter

import android.content.Context
import android.content.SharedPreferences
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.text.SimpleDateFormat
import java.util.*

class StepCounterModule : Module(), SensorEventListener {
  private val context: Context
    get() = appContext.reactContext ?: throw Exception("No React context")

  private fun prefs(): SharedPreferences =
    context.getSharedPreferences("step_counter", Context.MODE_PRIVATE)

  private var sensorManager: SensorManager? = null
  private var stepSensor: Sensor? = null
  private var lastStepCount = 0

  override fun definition() = ModuleDefinition {
    Name("StepCounter")

    Function("startListening") {
      sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      if (stepSensor != null) {
        sensorManager?.registerListener(this@StepCounterModule, stepSensor, SensorManager.SENSOR_DELAY_UI)
      }
    }

    Function("stopListening") {
      if (sensorManager != null && stepSensor != null) {
        sensorManager?.unregisterListener(this@StepCounterModule, stepSensor)
      }
    }

    AsyncFunction("getTodaySteps") {
      try {
        readTodaySteps()
      } catch (e: Exception) {
        0
      }
    }

    AsyncFunction("getStepGoal") {
      try {
        prefs().getInt("stepGoal", 10000)
      } catch (e: Exception) {
        10000
      }
    }

    AsyncFunction("setStepGoal") { goal: Int ->
      try {
        prefs().edit().putInt("stepGoal", goal).apply()
        true
      } catch (e: Exception) {
        false
      }
    }
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
      val steps = event.values[0].toInt()
      val today = getTodayString()
      try {
        // Sensor reports cumulative steps since boot; persist raw value per day.
        prefs().edit()
          .putString("stepDate", today)
          .putInt("stepCount", steps)
          .apply()
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
      val date = prefs().getString("stepDate", null) ?: return 0
      if (date != getTodayString()) return 0
      return prefs().getInt("stepCount", 0)
    } catch (e: Exception) {
      return 0
    }
  }

  private fun getTodayString(): String {
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    return formatter.format(Date())
  }
}

package com.yagyaraj.locked

import android.animation.ObjectAnimator
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.LinearLayout
import android.widget.TextView

class BlockingActivity : Activity() {

  companion object {
    const val EXTRA_BLOCKED_PACKAGE = "blockedPackage"
  }

  private var secondsRemaining = 300 // 5-minute default
  private lateinit var timerText: TextView
  private lateinit var breatheText: TextView
  private var timerRunning = false
  private var isInForeground = false
  private var breatheAnimatorX: ObjectAnimator? = null
  private var breatheAnimatorY: ObjectAnimator? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#000000"))
      setPadding(24, 24, 24, 24)
    }

    val subtitle = TextView(this).apply {
      text = "Time to pause"
      textSize = 16f
      setTextColor(Color.parseColor("#999999"))
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 8)
    }

    val caption = TextView(this).apply {
      text = "This app is temporarily paused to help you find balance."
      textSize = 14f
      setTextColor(Color.parseColor("#999999"))
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 60)
      isClickable = false
    }

    breatheText = TextView(this).apply {
      text = "EXHALE"
      textSize = 56f
      setTextColor(Color.parseColor("#1E90FF"))
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 60)
    }

    timerText = TextView(this).apply {
      text = "05:00"
      textSize = 72f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 8)
    }

    val timerCaption = TextView(this).apply {
      text = "REMAINING BALANCE"
      textSize = 11f
      setTextColor(Color.parseColor("#999999"))
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 80)
    }

    root.addView(subtitle)
    root.addView(caption)
    root.addView(breatheText)
    root.addView(timerText)
    root.addView(timerCaption)

    setContentView(
      root,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    )

    startTimer()
    startBreathingAnimation()
  }

  private fun startTimer() {
    timerRunning = true
    object : Thread() {
      override fun run() {
        while (secondsRemaining > 0 && timerRunning) {
          Thread.sleep(1000)
          secondsRemaining--
          updateTimer()
        }
        if (timerRunning) {
          sendUserHome()
        }
      }
    }.start()
  }

  private fun updateTimer() {
    runOnUiThread {
      val minutes = secondsRemaining / 60
      val seconds = secondsRemaining % 60
      timerText.text = "%02d:%02d".format(minutes, seconds)
    }
  }

  private fun startBreathingAnimation() {
    breatheAnimatorX = ObjectAnimator.ofFloat(breatheText, "scaleX", 1f, 1.2f, 1f).apply {
      duration = 4000
      interpolator = AccelerateDecelerateInterpolator()
      repeatCount = ObjectAnimator.INFINITE
    }
    breatheAnimatorY = ObjectAnimator.ofFloat(breatheText, "scaleY", 1f, 1.2f, 1f).apply {
      duration = 4000
      interpolator = AccelerateDecelerateInterpolator()
      repeatCount = ObjectAnimator.INFINITE
    }
    breatheAnimatorX?.start()
    breatheAnimatorY?.start()
  }

  override fun onResume() {
    super.onResume()
    isInForeground = true
  }

  override fun onPause() {
    super.onPause()
    isInForeground = false
  }

  private fun sendUserHome() {
    if (isInForeground) {
      val home = Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      startActivity(home)
    }
    finish()
  }

  override fun onBackPressed() {
    sendUserHome()
  }

  override fun onDestroy() {
    timerRunning = false
    breatheAnimatorX?.cancel()
    breatheAnimatorY?.cancel()
    super.onDestroy()
  }
}

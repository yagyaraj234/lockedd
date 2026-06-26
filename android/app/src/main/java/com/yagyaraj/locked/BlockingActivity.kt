package com.yagyaraj.locked

import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.LinearLayout
import android.widget.TextView

class BlockingActivity : Activity() {

    companion object {
        const val EXTRA_BLOCKED_PACKAGE = "blockedPackage"
    }

    private var secondsRemaining = 300
    private lateinit var timerText: TextView
    private lateinit var phaseText: TextView
    private lateinit var orbView: BreathingOrbView
    private var timerRunning = false
    private var isInForeground = false
    private val handler = Handler(Looper.getMainLooper())
    private var breathingAnimator: ValueAnimator? = null

    // Box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s
    private val phaseLabels = arrayOf("inhale", "hold", "exhale", "hold")
    private val phaseDurations = longArrayOf(4000L, 4000L, 4000L, 4000L)
    private val phaseScales = arrayOf(
        Pair(0.72f, 1.0f),
        Pair(1.0f, 1.0f),
        Pair(1.0f, 0.72f),
        Pair(0.72f, 0.72f)
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (LATENCY_LOG) {
            android.util.Log.d("BlockLatency", "onCreate t=${System.currentTimeMillis()}")
        }
        setContentView(
            buildLayout(),
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        )
        startTimer()
        runBreathingPhase(0)
    }

    private fun buildLayout(): LinearLayout {
        val d = resources.displayMetrics.density

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.parseColor("#07070C"))
        }

        // Flexible top spacer
        root.addView(View(this), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        // App wordmark — near invisible, whispers at top
        root.addView(TextView(this).apply {
            text = "· locked ·"
            textSize = 10f
            setTextColor(Color.parseColor("#1A1A2E"))
            gravity = Gravity.CENTER
            letterSpacing = 0.35f
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            bottomMargin = (52 * d).toInt()
        })

        // Breathing orb — the focus
        orbView = BreathingOrbView(this)
        val orbSize = (196 * d).toInt()
        root.addView(orbView, LinearLayout.LayoutParams(orbSize, orbSize).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        })

        // Phase label — lowercase, intimate
        phaseText = TextView(this).apply {
            text = "inhale"
            textSize = 12f
            setTextColor(Color.parseColor("#7C3AED"))
            gravity = Gravity.CENTER
            letterSpacing = 0.25f
            alpha = 0.8f
        }
        root.addView(phaseText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = (20 * d).toInt()
        })

        // Spacer before divider
        root.addView(View(this), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (44 * d).toInt()))

        // Thin hairline divider — 72dp wide, centered
        root.addView(View(this).apply {
            setBackgroundColor(Color.parseColor("#111128"))
        }, LinearLayout.LayoutParams((72 * d).toInt(), 1).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        })

        // Spacer after divider
        root.addView(View(this), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (28 * d).toInt()))

        // Timer — monospace, de-emphasized
        timerText = TextView(this).apply {
            text = "05:00"
            textSize = 52f
            typeface = Typeface.MONOSPACE
            setTextColor(Color.parseColor("#C4C4D4"))
            gravity = Gravity.CENTER
            letterSpacing = 0.04f
        }
        root.addView(timerText, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        })

        // Timer sub-label
        root.addView(TextView(this).apply {
            text = "minutes remaining"
            textSize = 10f
            setTextColor(Color.parseColor("#22223A"))
            gravity = Gravity.CENTER
            letterSpacing = 0.18f
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = (6 * d).toInt()
        })

        // Flexible bottom spacer
        root.addView(View(this), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        return root
    }

    private fun startTimer() {
        timerRunning = true
        Thread {
            while (secondsRemaining > 0 && timerRunning) {
                Thread.sleep(1000)
                secondsRemaining--
                val m = secondsRemaining / 60
                val s = secondsRemaining % 60
                handler.post { timerText.text = "%02d:%02d".format(m, s) }
            }
            if (timerRunning) handler.post { sendUserHome() }
        }.start()
    }

    private fun runBreathingPhase(phase: Int) {
        if (!timerRunning) return

        // Fade-swap phase text
        ObjectAnimator.ofFloat(phaseText, "alpha", 0.8f, 0.2f).apply {
            duration = 220
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    phaseText.text = phaseLabels[phase]
                    ObjectAnimator.ofFloat(phaseText, "alpha", 0.2f, 0.8f).apply {
                        duration = 280
                        start()
                    }
                }
            })
            start()
        }

        val (startScale, endScale) = phaseScales[phase]
        breathingAnimator?.cancel()
        breathingAnimator = ValueAnimator.ofFloat(startScale, endScale).apply {
            duration = phaseDurations[phase]
            interpolator = when (phase) {
                0 -> DecelerateInterpolator(1.6f)
                2 -> AccelerateInterpolator(1.6f)
                else -> LinearInterpolator()
            }
            addUpdateListener { orbView.breathScale = it.animatedValue as Float }
            addListener(object : AnimatorListenerAdapter() {
                private var cancelled = false
                override fun onAnimationCancel(animation: android.animation.Animator) { cancelled = true }
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    if (!cancelled && timerRunning) runBreathingPhase((phase + 1) % 4)
                }
            })
            start()
        }
    }

    override fun onResume() { super.onResume(); isInForeground = true }
    override fun onPause() { super.onPause(); isInForeground = false }

    private fun sendUserHome() {
        if (isInForeground) {
            startActivity(Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            })
        }
        finish()
    }

    override fun onBackPressed() { sendUserHome() }

    override fun onDestroy() {
        timerRunning = false
        breathingAnimator?.cancel()
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}

class BreathingOrbView(context: Context) : View(context) {

    var breathScale: Float = 0.72f
        set(value) { field = value; invalidate() }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val maxR = minOf(width, height) / 2f
        val coreR = maxR * 0.44f * breathScale

        // Glow halos — 4 concentric rings, alpha falls off outward
        for (i in 4 downTo 1) {
            val haloR = coreR + (i * maxR * 0.085f * breathScale)
            val alpha = (42 - i * 9).coerceAtLeast(0)
            paint.color = Color.argb(alpha, 124, 58, 237)
            paint.style = Paint.Style.FILL
            canvas.drawCircle(cx, cy, haloR, paint)
        }

        // Core orb — radial gradient from pale violet center to dark edge
        paint.shader = RadialGradient(
            cx, cy - coreR * 0.08f, coreR,
            intArrayOf(
                Color.parseColor("#DDD6FE"),
                Color.parseColor("#8B5CF6"),
                Color.parseColor("#3B1C72")
            ),
            floatArrayOf(0f, 0.48f, 1f),
            Shader.TileMode.CLAMP
        )
        paint.style = Paint.Style.FILL
        canvas.drawCircle(cx, cy, coreR, paint)
        paint.shader = null

        // Specular highlight
        paint.color = Color.argb(32, 255, 255, 255)
        canvas.drawCircle(cx - coreR * 0.18f, cy - coreR * 0.22f, coreR * 0.27f, paint)
    }
}

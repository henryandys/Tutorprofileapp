import { useState, useEffect } from "react"
import { Link } from "react-router"
import { Navbar } from "../components/Navbar"
import { Star, ChevronLeft, Loader2, CornerDownRight, Send, Pencil } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { supabase } from "../../lib/supabase"
import { toast } from "sonner"

interface Review {
  id:           string
  student_id:   string
  student_name: string
  rating:       number
  body:         string
  created_at:   string
  tutor_reply:  string | null
  replied_at:   string | null
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

export function TutorReviews() {
  const { user, profile } = useAuth()
  const [reviews, setReviews]         = useState<Review[]>([])
  const [loading, setLoading]         = useState(true)
  const [replyingTo, setReplyingTo]   = useState<string | null>(null)
  const [replyText, setReplyText]     = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('reviews')
      .select('*')
      .eq('tutor_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setReviews(data ?? [])
        setLoading(false)
      })
  }, [user])

  function openReply(review: Review) {
    setReplyingTo(review.id)
    setReplyText(review.tutor_reply ?? '')
  }

  function cancelReply() {
    setReplyingTo(null)
    setReplyText('')
  }

  async function submitReply(reviewId: string) {
    if (!replyText.trim()) { toast.error('Reply cannot be empty.'); return }
    setSubmitting(true)
    const replied_at = new Date().toISOString()
    const { data: updated, error } = await supabase
      .from('reviews')
      .update({ tutor_reply: replyText.trim(), replied_at })
      .eq('id', reviewId)
      .eq('tutor_id', user!.id)
      .select('id')
    if (error) {
      console.error('Reply update error:', error)
      toast.error('Failed to save reply: ' + error.message)
      setSubmitting(false)
      return
    }
    if (!updated || updated.length === 0) {
      console.warn('Reply update matched 0 rows — check RLS policy on reviews table')
      toast.error('Reply not saved. Check your Supabase RLS policy allows tutors to update reviews.')
      setSubmitting(false)
      return
    }
    setReviews(prev => prev.map(r =>
      r.id === reviewId ? { ...r, tutor_reply: replyText.trim(), replied_at } : r
    ))
    toast.success('Reply saved.')
    setReplyingTo(null)
    setReplyText('')
    setSubmitting(false)
  }

  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null

  const breakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct:   reviews.length ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100) : 0,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">

        <Link to="/my-profile" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to my profile
        </Link>

        <h1 className="text-3xl font-black text-gray-900 mb-6">My Reviews</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
            <Star className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-xl font-bold text-gray-700 mb-1">No reviews yet</p>
            <p className="text-gray-400 font-medium text-sm">Reviews from students will appear here after they rate their lessons.</p>
          </div>
        ) : (
          <>
            {/* Summary card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-6 flex flex-col sm:flex-row gap-6 items-center">
              <div className="flex flex-col items-center shrink-0">
                <span className="text-6xl font-black text-gray-900">{avg}</span>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`w-5 h-5 ${i <= Math.round(avg ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
                  ))}
                </div>
                <span className="text-sm text-gray-400 font-medium mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex-1 w-full flex flex-col gap-1.5">
                {breakdown.map(({ star, count, pct }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 w-3">{star}</span>
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-400 w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review list */}
            <div className="flex flex-col gap-4">
              {reviews.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

                  {/* Student review */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{r.student_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
                        ))}
                        <span className="text-xs font-bold text-gray-500 ml-1">{LABELS[r.rating]}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 font-medium shrink-0">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {r.body && <p className="text-gray-600 font-medium text-sm leading-relaxed">{r.body}</p>}

                  {/* Existing reply */}
                  {r.tutor_reply && replyingTo !== r.id && (
                    <div className="mt-4 ml-4 pl-4 border-l-2 border-blue-200">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                          <CornerDownRight className="w-3 h-3" />
                          {profile?.full_name ?? 'You'} (tutor)
                        </span>
                        <button
                          onClick={() => openReply(r)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 font-medium leading-relaxed">{r.tutor_reply}</p>
                    </div>
                  )}

                  {/* Reply form */}
                  {replyingTo === r.id ? (
                    <div className="mt-4 ml-4 pl-4 border-l-2 border-blue-300">
                      <p className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1">
                        <CornerDownRight className="w-3 h-3" />
                        Your reply
                      </p>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="Write a response to this review…"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={cancelReply}
                          className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => submitReply(r.id)}
                          disabled={submitting}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {submitting ? 'Saving…' : 'Post reply'}
                        </button>
                      </div>
                    </div>
                  ) : !r.tutor_reply ? (
                    <button
                      onClick={() => openReply(r)}
                      className="mt-3 flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                      Reply to this review
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// src/app/pages/RequestedTutors.tsx
//
// Supabase tables required:
//
//   create table tutor_requests (
//     id            uuid primary key default gen_random_uuid(),
//     subject       text not null,
//     description   text,
//     suggested_by  uuid references auth.users(id),
//     suggester_name text,
//     vote_count    int not null default 0,
//     created_at    timestamptz not null default now()
//   );
//
//   create table tutor_request_votes (
//     request_id uuid references tutor_requests(id) on delete cascade,
//     user_id    uuid references auth.users(id) on delete cascade,
//     primary key (request_id, user_id)
//   );
//
//   -- RLS
//   alter table tutor_requests       enable row level security;
//   alter table tutor_request_votes  enable row level security;
//   create policy "Anyone reads requests"   on tutor_requests      for select using (true);
//   create policy "Auth users insert"       on tutor_requests      for insert with check (auth.uid() = suggested_by);
//   create policy "Auth users update votes" on tutor_requests      for update using (true);
//   create policy "Users delete own"        on tutor_requests      for delete using (auth.uid() = suggested_by);
//   create policy "Anyone reads votes"      on tutor_request_votes for select using (true);
//   create policy "Users manage own votes"  on tutor_request_votes for insert with check (auth.uid() = user_id);
//   create policy "Users delete own votes"  on tutor_request_votes for delete using (auth.uid() = user_id);

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useSearchParams, Link } from "react-router"
import { Navbar } from "../components/Navbar"
import { Trophy, ThumbsUp, Plus, Loader2, Lightbulb, Trash2, ArrowRight, X } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../context/AuthContext"

interface TutorRequest {
  id:          string
  subject:     string
  description: string | null
  vote_count:  number
}

interface SuggestForm {
  subject:     string
  description: string
}

export function RequestedTutors() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const mineMode = searchParams.get('mine') === 'true'

  const [requests,        setRequests]        = useState<TutorRequest[]>([])
  const [myVotes,         setMyVotes]         = useState<Set<string>>(new Set())
  const [myRequestCount,  setMyRequestCount]  = useState(0)
  const [loading,         setLoading]         = useState(true)
  const [voting,          setVoting]          = useState<string | null>(null)
  const [deleting,        setDeleting]        = useState<string | null>(null)
  const [showForm,        setShowForm]        = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [pendingVote,     setPendingVote]     = useState<TutorRequest | null>(null)
  const [myRequestsList,  setMyRequestsList]  = useState<TutorRequest[]>([])
  const [loadingMyList,   setLoadingMyList]   = useState(false)

  const REQUEST_LIMIT = 10

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SuggestForm>()

  useEffect(() => { load() }, [user?.id, mineMode])

  async function load() {
    setLoading(true)

    let query = supabase
      .from('tutor_requests')
      .select('id, subject, description, vote_count')

    if (mineMode && user) {
      query = query.eq('suggested_by', user.id).order('created_at', { ascending: false })
    } else {
      query = query.order('vote_count', { ascending: false }).limit(50)
    }

    const { data, error } = await query
    if (error) { toast.error('Failed to load requests.'); setLoading(false); return }

    let processed: TutorRequest[] = data ?? []

    if (!mineMode) {
      const seen = new Map<string, { req: TutorRequest; rowCount: number; totalVotes: number }>()
      for (const req of processed) {
        const key = req.subject.toLowerCase().trim()
        if (seen.has(key)) {
          const e = seen.get(key)!
          seen.set(key, { req: e.req, rowCount: e.rowCount + 1, totalVotes: e.totalVotes + req.vote_count })
        } else {
          seen.set(key, { req, rowCount: 1, totalVotes: req.vote_count })
        }
      }
      processed = Array.from(seen.values())
        .map(({ req, rowCount, totalVotes }) => ({
          ...req,
          vote_count: rowCount > 1 ? Math.max(rowCount, totalVotes) : totalVotes,
        }))
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 10)
    }

    setRequests(processed)

    if (user) {
      const { count } = await supabase
        .from('tutor_requests')
        .select('id', { count: 'exact', head: true })
        .eq('suggested_by', user.id)
      setMyRequestCount(count ?? 0)
    }

    if (!mineMode && user && processed.length > 0) {
      const { data: votes } = await supabase
        .from('tutor_request_votes')
        .select('request_id')
        .eq('user_id', user.id)
        .in('request_id', processed.map(r => r.id))
      setMyVotes(new Set((votes ?? []).map((v: { request_id: string }) => v.request_id)))
    }

    setLoading(false)
  }

  async function loadMyRequests() {
    if (!user) return
    setLoadingMyList(true)
    const { data } = await supabase
      .from('tutor_requests')
      .select('id, subject, description, vote_count')
      .eq('suggested_by', user.id)
      .order('created_at', { ascending: false })
    setMyRequestsList(data ?? [])
    setLoadingMyList(false)
  }

  // Cast a vote for req without checking the request limit.
  // Also creates an owned tutor_requests row so the subject appears in "mine" mode.
  async function castVote(req: TutorRequest) {
    if (!user) return false

    // Avoid duplicating the user's own row for this subject
    const { data: existingOwn } = await supabase
      .from('tutor_requests')
      .select('id')
      .eq('suggested_by', user.id)
      .ilike('subject', req.subject)
      .neq('id', req.id)
      .maybeSingle()

    if (!existingOwn) {
      await supabase.from('tutor_requests').insert({
        subject:        req.subject,
        suggested_by:   user.id,
        suggester_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'Anonymous',
        vote_count:     0,
      })
      setMyRequestCount(c => c + 1)
    }

    const { error } = await supabase
      .from('tutor_request_votes')
      .insert({ request_id: req.id, user_id: user.id })
    if (error) { toast.error('Could not vote.'); return false }

    await supabase.from('tutor_requests').update({ vote_count: req.vote_count + 1 }).eq('id', req.id)
    setRequests(prev =>
      prev.map(r => r.id === req.id ? { ...r, vote_count: r.vote_count + 1 } : r)
          .sort((a, b) => b.vote_count - a.vote_count)
    )
    setMyVotes(prev => new Set([...prev, req.id]))
    return true
  }

  async function handleVote(req: TutorRequest) {
    if (!user) { toast.error('Sign in to vote.'); return }
    const hasVoted = myVotes.has(req.id)

    if (hasVoted) {
      setVoting(req.id)

      const { error } = await supabase
        .from('tutor_request_votes')
        .delete()
        .eq('request_id', req.id)
        .eq('user_id', user.id)
      if (error) { toast.error('Could not remove vote.'); setVoting(null); return }

      await supabase.from('tutor_requests').update({ vote_count: Math.max(0, req.vote_count - 1) }).eq('id', req.id)

      // Remove the user's endorsed row for this subject (if it exists and isn't the canonical row)
      const { data: endorsedRow } = await supabase
        .from('tutor_requests')
        .select('id')
        .eq('suggested_by', user.id)
        .ilike('subject', req.subject)
        .neq('id', req.id)
        .maybeSingle()
      if (endorsedRow) {
        await supabase.from('tutor_requests').delete().eq('id', endorsedRow.id)
        setMyRequestCount(c => Math.max(0, c - 1))
      }

      setRequests(prev =>
        prev.map(r => r.id === req.id ? { ...r, vote_count: Math.max(0, r.vote_count - 1) } : r)
            .sort((a, b) => b.vote_count - a.vote_count)
      )
      setMyVotes(prev => { const next = new Set(prev); next.delete(req.id); return next })
      setVoting(null)
    } else {
      if (myRequestCount >= REQUEST_LIMIT) {
        setPendingVote(req)
        loadMyRequests()
        return
      }
      setVoting(req.id)
      await castVote(req)
      setVoting(null)
    }
  }

  // Remove one of the user's existing requests, then cast the pending vote.
  async function handleRemoveAndVote(myReq: TutorRequest) {
    if (!pendingVote) return
    setDeleting(myReq.id)

    // If this was an endorsed row (vote_count = 0), also remove the vote on the canonical row
    if (myReq.vote_count === 0) {
      const { data: canonical } = await supabase
        .from('tutor_requests')
        .select('id, vote_count')
        .ilike('subject', myReq.subject)
        .neq('id', myReq.id)
        .order('vote_count', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (canonical) {
        await supabase.from('tutor_request_votes').delete().eq('request_id', canonical.id).eq('user_id', user!.id)
        await supabase.from('tutor_requests').update({ vote_count: Math.max(0, canonical.vote_count - 1) }).eq('id', canonical.id)
        if (myVotes.has(canonical.id)) {
          setRequests(prev =>
            prev.map(r => r.id === canonical.id ? { ...r, vote_count: Math.max(0, r.vote_count - 1) } : r)
                .sort((a, b) => b.vote_count - a.vote_count)
          )
          setMyVotes(prev => { const next = new Set(prev); next.delete(canonical.id); return next })
        }
      }
    }

    const { error } = await supabase.from('tutor_requests').delete().eq('id', myReq.id)
    if (error) { toast.error('Could not remove request.'); setDeleting(null); return }

    setMyRequestsList(prev => prev.filter(r => r.id !== myReq.id))
    setMyRequestCount(c => Math.max(0, c - 1))
    setDeleting(null)

    const toVote = pendingVote
    setPendingVote(null)
    setVoting(toVote.id)
    await castVote(toVote)
    setVoting(null)
  }

  async function handleDelete(req: TutorRequest) {
    setDeleting(req.id)

    // Endorsed rows (vote_count = 0) have a vote on the canonical row — clean it up
    if (req.vote_count === 0) {
      const { data: canonical } = await supabase
        .from('tutor_requests')
        .select('id, vote_count')
        .ilike('subject', req.subject)
        .neq('id', req.id)
        .order('vote_count', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (canonical) {
        await supabase.from('tutor_request_votes').delete().eq('request_id', canonical.id).eq('user_id', user!.id)
        await supabase.from('tutor_requests').update({ vote_count: Math.max(0, canonical.vote_count - 1) }).eq('id', canonical.id)
      }
    }

    const { error } = await supabase.from('tutor_requests').delete().eq('id', req.id)
    if (error) {
      toast.error('Could not delete request.')
    } else {
      setRequests(prev => prev.filter(r => r.id !== req.id))
      setMyRequestCount(c => Math.max(0, c - 1))
      toast.success('Request removed.')
    }
    setDeleting(null)
  }

  async function onSubmit(data: SuggestForm) {
    if (!user) { toast.error('Sign in to suggest.'); return }
    if (myRequestCount >= REQUEST_LIMIT) {
      toast.error(`You've reached the ${REQUEST_LIMIT}-request limit. Remove one to add another.`)
      return
    }
    setSubmitting(true)

    const subject = data.subject.trim()

    const { data: existing } = await supabase
      .from('tutor_requests')
      .select('id, subject, vote_count')
      .ilike('subject', subject)
      .maybeSingle()

    if (existing) {
      if (myVotes.has(existing.id)) {
        toast.info(`"${existing.subject}" is already on the list and you've already voted for it.`)
      } else {
        const { error } = await supabase
          .from('tutor_request_votes')
          .insert({ request_id: existing.id, user_id: user.id })
        if (error) {
          toast.error('Could not add your vote.')
        } else {
          await supabase
            .from('tutor_requests')
            .update({ vote_count: existing.vote_count + 1 })
            .eq('id', existing.id)
          toast.success(`"${existing.subject}" already exists — your vote has been added!`)
          reset()
          setShowForm(false)
          load()
        }
      }
    } else {
      const { data: newRow, error } = await supabase
        .from('tutor_requests')
        .insert({
          subject,
          description:    data.description.trim() || null,
          suggested_by:   user.id,
          suggester_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'Anonymous',
          vote_count:     1,
        })
        .select('id')
        .single()
      if (error) {
        toast.error('Could not submit suggestion.')
      } else {
        await supabase.from('tutor_request_votes').insert({ request_id: newRow.id, user_id: user.id })
        setMyRequestCount(c => c + 1)
        toast.success('Request added!')
        reset()
        setShowForm(false)
        load()
      }
    }

    setSubmitting(false)
  }

  const rankIcon = (i: number) => {
    const color = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-600'
    return <Trophy className={`w-5 h-5 mx-auto ${color}`} />
  }

  const rankBg = (i: number) =>
    i === 0 ? 'bg-yellow-50 border-yellow-200' :
    i === 1 ? 'bg-gray-50  border-gray-200'  :
    i === 2 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${mineMode ? 'bg-amber-100' : 'bg-blue-100'}`}>
            {mineMode
              ? <Lightbulb className="w-8 h-8 text-amber-600" />
              : <Trophy className="w-8 h-8 text-blue-600" />
            }
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
            {mineMode ? 'Your Requested Courses' : 'Most Wanted Instructors'}
          </h1>
          <p className="text-gray-500 font-medium max-w-md mx-auto">
            {mineMode
              ? 'Courses you have requested or voted for. Add new ones or remove ones you no longer need.'
              : 'Vote for the subjects you most want covered. The top 10 guide who we recruit next.'
            }
          </p>
          {mineMode && (
            <Link
              to="/needed-courses"
              className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              See the full ranked leaderboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* At-limit picker — shown when user tries to vote but is at the cap */}
        {pendingVote && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-black text-amber-900">You've used all {REQUEST_LIMIT} request slots</p>
                <p className="text-sm text-amber-700 font-medium mt-0.5">
                  Remove one below to vote for <span className="font-black">"{pendingVote.subject}"</span>
                </p>
              </div>
              <button
                onClick={() => setPendingVote(null)}
                className="text-amber-500 hover:text-amber-700 transition-colors ml-4 mt-0.5"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {loadingMyList ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {myRequestsList.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-white rounded-xl border border-amber-100 px-4 py-3">
                    <div className="min-w-0 mr-3">
                      <p className="font-bold text-gray-800 text-sm truncate">{r.subject}</p>
                      {r.vote_count === 0 && (
                        <p className="text-xs text-green-600 font-semibold">Voted</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveAndVote(r)}
                      disabled={deleting === r.id}
                      className="shrink-0 flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-700 transition-colors disabled:opacity-60"
                    >
                      {deleting === r.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                      Remove &amp; Vote
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
            {mineMode
              ? <Lightbulb className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              : <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            }
            <p className="text-gray-400 font-medium">
              {mineMode ? "You haven't requested any courses yet." : 'No suggestions yet — be the first!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {requests.map((req, i) => (
              <div
                key={req.id}
                className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${mineMode ? 'bg-white border-gray-100' : rankBg(i)}`}
              >
                {/* Rank badge — leaderboard mode only */}
                {!mineMode && (
                  <div className="w-8 shrink-0 text-center">
                    {i < 3
                      ? rankIcon(i)
                      : <span className="text-sm font-black text-gray-400">#{i + 1}</span>
                    }
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 truncate">{req.subject}</p>
                  {req.description && (
                    <p className="text-sm text-gray-500 font-medium mt-0.5 line-clamp-1">{req.description}</p>
                  )}
                </div>

                {/* Mine mode: vote count / endorsed badge + delete */}
                {mineMode ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {req.vote_count === 0 ? (
                      <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border border-green-100 bg-green-50 min-w-[52px]">
                        <ThumbsUp className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold text-green-600 leading-none">Voted</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 min-w-[52px]">
                        <ThumbsUp className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-500 leading-none">{req.vote_count}</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleDelete(req)}
                      disabled={deleting === req.id}
                      className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-60"
                    >
                      {deleting === req.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                ) : (
                  /* Leaderboard mode: vote button */
                  <button
                    onClick={() => handleVote(req)}
                    disabled={voting === req.id}
                    className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border font-bold transition-all disabled:opacity-60 min-w-[52px] ${
                      myVotes.has(req.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {voting === req.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <ThumbsUp className="w-4 h-4" />
                    }
                    <span className="text-xs leading-none">{req.vote_count}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Suggest / add section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {!showForm ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  if (!user) { toast.error('Sign in to request an instructor type.'); return }
                  if (myRequestCount >= REQUEST_LIMIT) {
                    toast.error(`You've reached the ${REQUEST_LIMIT}-request limit. Remove one to add another.`)
                    return
                  }
                  setShowForm(true)
                }}
                disabled={user ? myRequestCount >= REQUEST_LIMIT : false}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-500"
              >
                <Plus className="w-4 h-4" />
                {mineMode ? 'Add a new request' : 'Suggest a new instructor type'}
              </button>
              {user && (
                <p className={`text-xs font-bold ${myRequestCount >= REQUEST_LIMIT ? 'text-red-500' : 'text-gray-400'}`}>
                  {REQUEST_LIMIT - myRequestCount} of {REQUEST_LIMIT} requests remaining
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <h3 className="font-black text-gray-900">
                {mineMode ? 'Add a course request' : 'Suggest an instructor type'}
              </h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject / Specialty *</label>
                <input
                  {...register('subject', { required: 'Subject is required' })}
                  placeholder="e.g. Piano, LSAT Prep, Mandarin"
                  className="w-full h-11 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                />
                {errors.subject && <span className="text-xs text-red-500 font-bold">{errors.subject.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Why it matters (optional)</label>
                <input
                  {...register('description')}
                  placeholder="e.g. Hard to find locally, high demand from students"
                  className="w-full h-11 px-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800 bg-gray-50"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); reset() }}
                  className="px-5 py-2 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit
                </button>
              </div>
            </form>
          )}
        </div>

        {!user && (
          <p className="text-center text-sm text-gray-400 font-medium mt-6">
            <a href="/login" className="text-blue-600 font-bold hover:underline">Sign in</a> to vote or suggest an instructor type.
          </p>
        )}
      </main>
    </div>
  )
}

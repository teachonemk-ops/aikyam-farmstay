// Database service production implementation using Supabase
import { supabase } from './supabaseClient';
import { isOverlapping, getTodayDateString, calculateNights } from './dateHelpers';

export const dbService = {
  // --- AUTH ---
  getCurrentUser: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    
    // Fetch profile to see if they are Admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
      
    if (profileError || !profile) return null;
    
    return {
      id: session.user.id,
      name: profile.name,
      email: profile.email,
      isAdmin: profile.is_admin
    };
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    
    if (error) throw new Error(error.message);
    
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
      
    if (profileError || !profile) {
      throw new Error('Failed to load user profile.');
    }
    
    return {
      id: data.user.id,
      name: profile.name,
      email: profile.email,
      isAdmin: profile.is_admin
    };
  },

  signup: async (email, password, name) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    
    // Sign up via Supabase Auth
    // Note: The public.handle_new_user() database trigger will run, check the whitelist,
    // and raise an error if they aren't whitelisted. That error will bubble up here.
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName
        }
      }
    });
    
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Signup failed.');
    
    // Fetch newly created profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
      
    if (profileError || !profile) {
      throw new Error('Sign up completed, but user profile could not be loaded. Please try logging in.');
    }
    
    return {
      id: data.user.id,
      name: profile.name,
      email: profile.email,
      isAdmin: profile.is_admin
    };
  },

  logout: async () => {
    await supabase.auth.signOut();
    return null;
  },

  // --- BOOKINGS ---
  getBookings: async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('check_in', { ascending: true });
      
    if (error) throw new Error(error.message);
    return data || [];
  },

  exportBookingsToCSV: async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, profiles(email)')
      .order('check_in', { ascending: true });
      
    if (error) throw new Error(error.message);
    return data || [];
  },

  createBooking: async (checkIn, checkOut, overrideUserId = null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const targetUserId = overrideUserId || session.user.id;

    // Fetch user profile to get their name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', targetUserId)
      .single();

    // Check active bookings limit (max 3 upcoming)
    const today = getTodayDateString();
    const { data: myUpcoming, error: limitError } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', targetUserId)
      .gte('check_out', today);

    if (limitError) throw new Error(limitError.message);
    if (myUpcoming && myUpcoming.length >= 3) {
      throw new Error('You have reached the limit of 3 active bookings. Complete or cancel a booking to add another.');
    }

    // Check overlaps
    const { data: allBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('*');

    if (fetchError) throw new Error(fetchError.message);
    const overlaps = allBookings.some(b => isOverlapping(checkIn, checkOut, b.check_in, b.check_out));
    if (overlaps) {
      throw new Error('These dates overlap with an existing booking.');
    }

    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        user_id: targetUserId,
        user_name: profile?.name || 'Friend',
        check_in: checkIn,
        check_out: checkOut
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);
    return newBooking;
  },

  editBooking: async (id, checkIn, checkOut) => {
    // Check overlaps with OTHER bookings (excluding itself)
    const { data: allBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .neq('id', id);

    if (fetchError) throw new Error(fetchError.message);
    const overlaps = allBookings.some(b => isOverlapping(checkIn, checkOut, b.check_in, b.check_out));
    if (overlaps) {
      throw new Error('These dates overlap with another existing booking.');
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        check_in: checkIn,
        check_out: checkOut
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);
    return updatedBooking;
  },

  cancelBooking: async (id) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // 1. Fetch the booking first to get details for notifications
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) throw new Error('Booking not found');

    // 2. Fetch pending requests for this booking to notify them
    const { data: pendingRequests } = await supabase
      .from('requests')
      .select('requester_id, check_in, check_out')
      .eq('booking_id', id)
      .eq('status', 'pending');

    // 3. Delete the booking (this will cascade delete requests in database)
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (deleteError) throw new Error(deleteError.message);

    // 4. Send notifications in database for cancelled requests
    const notificationsToInsert = [];
    
    if (pendingRequests && pendingRequests.length > 0) {
      pendingRequests.forEach(req => {
        notificationsToInsert.push({
          user_id: req.requester_id,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `${booking.user_name} cancelled their booking for ${booking.check_in} to ${booking.check_out}. These dates are now open!`,
          is_read: false
        });
      });
    }

    // 5. Send notifications to ALL other friends that slot opened up
    const { data: allProfiles } = await supabase.from('profiles').select('id');
    if (allProfiles) {
      allProfiles.forEach(p => {
        if (p.id !== session.user.id) {
          notificationsToInsert.push({
            user_id: p.id,
            type: 'slot_opened',
            title: 'Aikyam Farmstay Available!',
            message: `The dates ${booking.check_in} to ${booking.check_out} have just been freed up by ${booking.user_name}.`,
            is_read: false
          });
        }
      });
    }

    if (notificationsToInsert.length > 0) {
      await supabase.from('notifications').insert(notificationsToInsert);
    }

    // Trigger Resend email alerts in database settings (handled by trigger/edge-function or setting)
    console.log(`[DATABASE LOG] Cancelled booking ${id}. Slot notifications sent.`);
    return true;
  },

  // --- REQUESTS ---
  getRequests: async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*');
      
    if (error) throw new Error(error.message);
    return data || [];
  },

  createRequest: async (bookingId, checkIn, checkOut, reason) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Fetch original booking details
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking) throw new Error('Target booking not found');
    if (booking.user_id === session.user.id) throw new Error('You cannot request your own booking!');

    // Fetch requester profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', session.user.id)
      .single();

    // Create the request
    const { data: newRequest, error: insertError } = await supabase
      .from('requests')
      .insert({
        booking_id: bookingId,
        booking_owner_id: booking.user_id,
        requester_id: session.user.id,
        requester_name: profile?.name || 'Friend',
        reason: reason,
        check_in: checkIn,
        check_out: checkOut
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // Send in-app notification to booking owner
    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      type: 'request_received',
      title: 'New Booking Request',
      message: `${profile?.name || 'Friend'} requested your booked slot (${checkIn} to ${checkOut}): "${reason.substring(0, 40)}..."`,
      is_read: false
    });

    return newRequest;
  },

  respondToRequest: async (requestId, status) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // 1. Fetch request details
    const { data: request, error: fetchReqError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchReqError || !request) throw new Error('Request not found');

    // Fetch responder profile
    const { data: responderProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', session.user.id)
      .single();

    if (status === 'accepted') {
      // 2. Fetch other pending requests for the same booking to notify them BEFORE deleting the booking
      const { data: otherRequests } = await supabase
        .from('requests')
        .select('*')
        .eq('booking_id', request.booking_id)
        .neq('id', requestId);

      // 3. Prepare and insert notifications
      const notificationsToInsert = [];
      const now = new Date();
      const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

      // Immediate notification for the requester
      notificationsToInsert.push({
        user_id: request.requester_id,
        type: 'request_accepted',
        title: 'Request Accepted!',
        message: `${responderProfile?.name || 'Friend'} accepted your request. The booking has been cancelled and these dates are now free to book!`,
        is_read: false,
        created_at: now.toISOString()
      });

      // Delayed slot-opened notifications for everyone else
      const { data: allProfiles } = await supabase.from('profiles').select('id');
      if (allProfiles) {
        allProfiles.forEach(p => {
          // Exclude owner and the accepted requester
          if (p.id !== session.user.id && p.id !== request.requester_id) {
            const hadRequest = otherRequests?.some(r => r.requester_id === p.id);
            if (hadRequest) {
              notificationsToInsert.push({
                user_id: p.id,
                type: 'request_declined',
                title: 'Request Declined',
                message: `The booking for ${request.check_in} to ${request.check_out} was cancelled by the owner.`,
                is_read: false,
                created_at: fourHoursLater
              });
            } else {
              notificationsToInsert.push({
                user_id: p.id,
                type: 'slot_opened',
                title: 'Aikyam Farmstay Available!',
                message: `The dates ${request.check_in} to ${request.check_out} have just been freed up by ${responderProfile?.name || 'Friend'}.`,
                is_read: false,
                created_at: fourHoursLater
              });
            }
          }
        });
      }

      await supabase.from('notifications').insert(notificationsToInsert);

      // 4. Delete the original booking (this will automatically cascade-delete all request rows)
      const { error: deleteBookingError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', request.booking_id);

      if (deleteBookingError) throw new Error(deleteBookingError.message);
    } else if (status === 'accepted') {
      // Update status to declined
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: 'declined' })
        .eq('id', requestId);

      if (updateError) throw new Error(updateError.message);

      // Notify requester
      await supabase.from('notifications').insert({
        user_id: request.requester_id,
        type: 'request_declined',
        title: 'Request Declined',
        message: `${responderProfile?.name || 'Friend'} declined your request for ${request.check_in} to ${request.check_out}.`,
        is_read: false
      });
    }

    return { ...request, status };
  },

  // --- SUGGESTIONS ---
  getSuggestions: async () => {
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });

    if (suggestionsError) throw new Error(suggestionsError.message);

    const { data: votes, error: votesError } = await supabase
      .from('suggestion_votes')
      .select('*');

    if (votesError) throw new Error(votesError.message);

    // Format suggestions with score and votes lookup
    return (suggestions || []).map(s => {
      const voteMap = {};
      let score = 0;
      let upvoteCount = 0;
      let downvoteCount = 0;

      (votes || []).forEach(v => {
        if (v.suggestion_id === s.id) {
          voteMap[v.user_id] = v.vote;
          score += v.vote;
          if (v.vote === 1) upvoteCount++;
          if (v.vote === -1) downvoteCount++;
        }
      });

      return {
        ...s,
        votes: voteMap,
        score,
        upvoteCount,
        downvoteCount
      };
    });
  },

  createSuggestion: async (title, description) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', session.user.id)
      .single();

    const { data: newSuggestion, error } = await supabase
      .from('suggestions')
      .insert({
        user_id: session.user.id,
        user_name: profile?.name || 'Friend',
        title: title.trim(),
        description: description.trim()
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { ...newSuggestion, votes: {}, score: 0, upvoteCount: 0, downvoteCount: 0 };
  },

  editSuggestion: async (id, title, description) => {
    const { data, error } = await supabase
      .from('suggestions')
      .update({
        title: title.trim(),
        description: description.trim()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  deleteSuggestion: async (id) => {
    const { error } = await supabase
      .from('suggestions')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  },

  voteSuggestion: async (id, val) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Check if they already voted
    const { data: existingVote } = await supabase
      .from('suggestion_votes')
      .select('*')
      .eq('suggestion_id', id)
      .eq('user_id', session.user.id)
      .single();

    if (existingVote) {
      if (existingVote.vote === val) {
        // Toggle off
        const { error } = await supabase
          .from('suggestion_votes')
          .delete()
          .eq('suggestion_id', id)
          .eq('user_id', session.user.id);
        if (error) throw new Error(error.message);
      } else {
        // Change vote direction
        const { error } = await supabase
          .from('suggestion_votes')
          .update({ vote: val })
          .eq('suggestion_id', id)
          .eq('user_id', session.user.id);
        if (error) throw new Error(error.message);
      }
    } else {
      // Create new vote
      const { error } = await supabase
        .from('suggestion_votes')
        .insert({
          suggestion_id: id,
          user_id: session.user.id,
          vote: val
        });
      if (error) throw new Error(error.message);
    }

    return true;
  },

  // --- WHITELIST & SETTINGS ---
  getWhitelist: async () => {
    const { data, error } = await supabase
      .from('whitelist')
      .select('*')
      .order('created_at', { ascending: true });
      
    if (error) throw new Error(error.message);
    return data || [];
  },

  addToWhitelist: async (email, isAdmin = false) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase
      .from('whitelist')
      .insert({
        email: cleanEmail,
        is_admin: isAdmin,
        invited_by: session.user.id,
        registered: false
      })
      .select();

    if (error) {
      if (error.code === '23505') throw new Error('Email is already whitelisted.');
      throw new Error(error.message);
    }

    return data;
  },

  removeFromWhitelist: async (email) => {
    const { error } = await supabase
      .from('whitelist')
      .delete()
      .eq('email', email.trim().toLowerCase());

    if (error) throw new Error(error.message);
    return true;
  },

  toggleAdmin: async (email, isAdmin) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Update whitelist table
    const { error: whitelistError } = await supabase
      .from('whitelist')
      .update({ is_admin: isAdmin })
      .eq('email', cleanEmail);

    if (whitelistError) throw new Error(whitelistError.message);

    // 2. Update profiles table (succeeds if user is already registered)
    await supabase
      .from('profiles')
      .update({ is_admin: isAdmin })
      .eq('email', cleanEmail);

    return true;
  },

  getSettings: async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*');

    if (error) throw new Error(error.message);
    
    // Map list of key-values to an object
    const settingsObj = { resend_api_key: '', resend_from_email: 'noreply@aikyamfarmstay.com' };
    (data || []).forEach(s => {
      settingsObj[s.key] = s.value;
    });

    return settingsObj;
  },

  saveSettings: async (settingsMap) => {
    const rows = Object.entries(settingsMap).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('settings')
      .upsert(rows);

    if (error) throw new Error(error.message);
    return settingsMap;
  },

  // --- NOTIFICATIONS ---
  getNotifications: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  markNotificationsRead: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id);

    if (error) throw new Error(error.message);
    return true;
  },

  // --- PREVIEW SIMULATOR HELPERS (BYPASSED IN PROD / RETURN EMPTY) ---
  simulatorSwitchUser: () => {
    // Not supported in Supabase production mode
    return null;
  }
};

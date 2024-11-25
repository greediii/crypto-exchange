const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../db');

// Create a new ticket
router.post('/', auth, async (req, res) => {
  try {
    const { subject, message, priority } = req.body;
    
    console.log('Received ticket creation request:', {
      userId: req.user.userId,
      subject,
      message,
      priority
    });

    // Validate required fields
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ 
        message: 'Subject and message are required' 
      });
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high'];
    const ticketPriority = priority || 'normal';
    if (!validPriorities.includes(ticketPriority)) {
      return res.status(400).json({
        message: 'Invalid priority value'
      });
    }

    // Begin transaction
    const result = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO tickets (
          user_id, 
          subject, 
          message, 
          priority, 
          status, 
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      console.log('Executing SQL with params:', {
        userId: req.user.userId,
        subject,
        message,
        priority: ticketPriority
      });

      return stmt.run(
        req.user.userId, 
        subject.trim(), 
        message.trim(), 
        ticketPriority
      );
    })();

    console.log('Ticket created with ID:', result.lastInsertRowid);

    // Fetch and return the created ticket
    const createdTicket = db.prepare(`
      SELECT t.*, u.username as creator_username
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ 
      message: 'Ticket created successfully',
      ticket: createdTicket
    });
  } catch (error) {
    console.error('Ticket creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create ticket',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get user's tickets
router.get('/my', auth, async (req, res) => {
  try {
    const tickets = db.prepare(`
      SELECT * FROM tickets 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.user.userId);
    
    // Return empty array if no tickets found
    res.json(tickets || []);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    // Return empty array instead of error for no tickets
    res.json([]);
  }
});

// Get all tickets (support/admin/owner)
router.get('/all', auth, async (req, res) => {
  try {
    if (!['support', 'admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const tickets = db.prepare(`
      SELECT t.*, u.username 
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `).all();
    
    // Return empty array if no tickets found
    res.json(tickets || []);
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    // Return empty array instead of error for no tickets
    res.json([]);
  }
});

// Update ticket status (admin only)
router.put('/:ticketId/status', auth, async (req, res) => {
  try {
    if (!['support', 'admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { status } = req.body;
    db.prepare(`
      UPDATE tickets 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, req.params.ticketId);
    
    res.json({ message: 'Ticket status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update ticket' });
  }
});

// Get ticket details with messages
router.get('/:ticketId', auth, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    
    if (isNaN(ticketId)) {
      return res.status(400).json({ 
        message: 'Invalid ticket ID' 
      });
    }

    console.log('Fetching ticket details:', { ticketId });

    const ticket = db.prepare(`
      SELECT t.*, u.username as creator_username
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(ticketId);

    if (!ticket) {
      return res.status(404).json({ 
        message: 'Ticket not found' 
      });
    }

    // Check if user has access to this ticket
    if (req.user.role !== 'admin' && 
        req.user.role !== 'owner' && 
        req.user.role !== 'support' && 
        ticket.user_id !== req.user.userId) {
      return res.status(403).json({ 
        message: 'Unauthorized to view this ticket' 
      });
    }

    const responses = db.prepare(`
      SELECT r.*, u.username
      FROM ticket_responses r
      JOIN users u ON r.user_id = u.id
      WHERE r.ticket_id = ?
      ORDER BY r.created_at ASC
    `).all(ticketId);

    res.json({
      ticket,
      responses
    });
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).json({ 
      message: 'Failed to fetch ticket details',
      error: error.message 
    });
  }
});

// Add response to ticket
router.post('/:ticketId/responses', auth, async (req, res) => {
  try {
    // Allow owner, support, admin, or ticket creator to respond
    if (!['support', 'admin', 'owner'].includes(req.user.role) && 
        !isTicketOwner(req.params.ticketId, req.user.userId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { message } = req.body;
    
    // Insert the response
    const result = db.prepare(`
      INSERT INTO ticket_responses (ticket_id, user_id, message)
      VALUES (?, ?, ?)
    `).run(req.params.ticketId, req.user.userId, message);
    
    // Get the inserted response with username
    const response = db.prepare(`
      SELECT r.*, u.username
      FROM ticket_responses r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(result.lastInsertRowid);
   
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add response' });
  }
});

// Delete ticket (support only)
router.delete('/:ticketId', auth, async (req, res) => {
  try {
    if (!['support', 'admin', 'owner'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Delete responses first (foreign key constraint)
    db.prepare('DELETE FROM ticket_responses WHERE ticket_id = ?')
      .run(req.params.ticketId);
      
    // Then delete the ticket
    db.prepare('DELETE FROM tickets WHERE id = ?')
      .run(req.params.ticketId);
    
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ message: 'Failed to delete ticket' });
  }
});

// Helper function to check if user owns the ticket
function isTicketOwner(ticketId, userId) {
  const ticket = db.prepare('SELECT user_id FROM tickets WHERE id = ?').get(ticketId);
  return ticket && ticket.user_id === userId;
}

module.exports = router; 
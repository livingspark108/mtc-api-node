import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import FilingService, { CreateFilingRequest, UpdateFilingRequest } from '../services/filing.service';
import { FilingFilters } from '../repositories/filing.repository';
import { FilingStatus, FilingType, FilingPriority } from '../utils/constants';

export class FilingController {
  private filingService: FilingService;

  constructor() {
    this.filingService = new FilingService();
  }

  async getAllFilings(req: Request, res: Response): Promise<Response> {
    try {
      const filters: FilingFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        clientId: req.query.clientId ? parseInt(req.query.clientId as string) : undefined,
        caId: req.query.caId ? parseInt(req.query.caId as string) : undefined,
        status: req.query.status as FilingStatus,
        filingType: req.query.filingType as FilingType,
        priority: req.query.priority as FilingPriority,
        taxYear: req.query.taxYear as string,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
        dueDateFrom: req.query.dueDateFrom ? new Date(req.query.dueDateFrom as string) : undefined,
        dueDateTo: req.query.dueDateTo ? new Date(req.query.dueDateTo as string) : undefined,
      };

      const result = await this.filingService.getAllFilings(filters);

      return ResponseUtil.paginated(res, result.data, result.pagination);
    } catch (error: any) {
      logger.error('Error fetching filings:', error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch filings', 500);
    }
  }

  async getFilingById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const filing = await this.filingService.getFilingById(filingId);

      if (!filing) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, filing, 'Filing retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to fetch filing', 500);
    }
  }

  async getFilingsByClientId(req: Request, res: Response): Promise<Response> {
    try {
      const { clientId } = req.params;
      const clientIdNum = parseInt(clientId);

      if (!clientIdNum || isNaN(clientIdNum)) {
        return ResponseUtil.error(res, 'Invalid client ID', 400);
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const status = req.query.status as FilingStatus;

      const filings = await this.filingService.getFilingsByClientId(clientIdNum, { limit, status });

      return ResponseUtil.success(res, filings, 'Client filings retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching filings for client ${req.params.clientId}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to fetch client filings', 500);
    }
  }

  async getFilingsByCAId(req: Request, res: Response): Promise<Response> {
    try {
      const { caId } = req.params;
      const caIdNum = parseInt(caId);

      if (!caIdNum || isNaN(caIdNum)) {
        return ResponseUtil.error(res, 'Invalid CA ID', 400);
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const status = req.query.status as FilingStatus;

      const filings = await this.filingService.getFilingsByCAId(caIdNum, { limit, status });

      return ResponseUtil.success(res, filings, 'CA filings retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching filings for CA ${req.params.caId}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('not a CA')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to fetch CA filings', 500);
    }
  }

  async createFiling(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const filingData: CreateFilingRequest = {
        clientId: req.body.clientId,
        taxYear: req.body.taxYear,
        filingType: req.body.filingType,
        priority: req.body.priority,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        notes: req.body.notes,
      };

      const newFiling = await this.filingService.createFiling(filingData);

      return ResponseUtil.success(res, newFiling, 'Filing created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating filing:', error);
      if (error.message.includes('required') || 
          error.message.includes('not found') || 
          error.message.includes('already exists') ||
          error.message.includes('Invalid')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to create filing', 500);
    }
  }

  async updateFiling(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const updateData: UpdateFilingRequest = {
        status: req.body.status,
        priority: req.body.priority,
        incomeSourcesJson: req.body.incomeSourcesJson,
        deductionsJson: req.body.deductionsJson,
        summaryJson: req.body.summaryJson,
        notes: req.body.notes,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };

      const updatedFiling = await this.filingService.updateFiling(filingId, updateData);

      if (!updatedFiling) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, updatedFiling, 'Filing updated successfully');
    } catch (error: any) {
      logger.error(`Error updating filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('transition')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to update filing', 500);
    }
  }

  async updateFilingStatus(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const { status, notes } = req.body;

      const updatedFiling = await this.filingService.updateFilingStatus(filingId, status, notes);

      if (!updatedFiling) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, updatedFiling, 'Filing status updated successfully');
    } catch (error: any) {
      logger.error(`Error updating filing status ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('transition')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to update filing status', 500);
    }
  }

  async assignCA(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const { caId } = req.body;

      const updatedFiling = await this.filingService.assignCA(filingId, caId);

      if (!updatedFiling) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, updatedFiling, 'CA assigned successfully');
    } catch (error: any) {
      logger.error(`Error assigning CA to filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('not a CA') || error.message.includes('not active')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to assign CA to filing', 500);
    }
  }

  async unassignCA(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const updatedFiling = await this.filingService.unassignCA(filingId);

      if (!updatedFiling) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, updatedFiling, 'CA unassigned successfully');
    } catch (error: any) {
      logger.error(`Error unassigning CA from filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('No CA assigned')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to unassign CA from filing', 500);
    }
  }

  async deleteFiling(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const deleted = await this.filingService.deleteFiling(filingId);

      if (!deleted) {
        return ResponseUtil.error(res, 'Filing not found or cannot be deleted', 404);
      }

      return ResponseUtil.success(res, null, 'Filing deleted successfully');
    } catch (error: any) {
      logger.error(`Error deleting filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('Only draft')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to delete filing', 500);
    }
  }

  async getFilingStats(req: Request, res: Response): Promise<Response> {
    try {
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
      const caId = req.query.caId ? parseInt(req.query.caId as string) : undefined;
      const taxYear = req.query.taxYear as string;

      const stats = await this.filingService.getFilingStats({ clientId, caId, taxYear });

      return ResponseUtil.success(res, stats, 'Filing statistics retrieved successfully');
    } catch (error: any) {
      logger.error('Error fetching filing stats:', error);
      return ResponseUtil.error(res, 'Failed to fetch filing statistics', 500);
    }
  }

  async getUpcomingDeadlines(req: Request, res: Response): Promise<Response> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const caId = req.query.caId ? parseInt(req.query.caId as string) : undefined;
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

      const filings = await this.filingService.getUpcomingDeadlines({ days, caId, clientId });

      return ResponseUtil.success(res, filings, 'Upcoming deadlines retrieved successfully');
    } catch (error: any) {
      logger.error('Error fetching upcoming deadlines:', error);
      return ResponseUtil.error(res, 'Failed to fetch upcoming deadlines', 500);
    }
  }

  async submitFiling(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const notes = req.body.notes || 'Filing submitted for review';

      const updatedFiling = await this.filingService.updateFilingStatus(filingId, 'under_review', notes);

      if (!updatedFiling) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, updatedFiling, 'Filing submitted successfully');
    } catch (error: any) {
      logger.error(`Error submitting filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('transition')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to submit filing', 500);
    }
  }

  async approveFiling(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const notes = req.body.notes || 'Filing approved and completed';

      const updatedFiling = await this.filingService.updateFilingStatus(filingId, 'completed', notes);

      if (!updatedFiling) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, updatedFiling, 'Filing approved successfully');
    } catch (error: any) {
      logger.error(`Error approving filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('transition')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to approve filing', 500);
    }
  }

  async rejectFiling(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const filingId = parseInt(id);

      if (!filingId || isNaN(filingId)) {
        return ResponseUtil.error(res, 'Invalid filing ID', 400);
      }

      const { reason } = req.body;
      if (!reason) {
        return ResponseUtil.error(res, 'Rejection reason is required', 400);
      }

      const updatedFiling = await this.filingService.updateFilingStatus(filingId, 'rejected', reason);

      if (!updatedFiling) {
        return ResponseUtil.error(res, 'Filing not found', 404);
      }

      return ResponseUtil.success(res, updatedFiling, 'Filing rejected');
    } catch (error: any) {
      logger.error(`Error rejecting filing ${req.params.id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('transition')) {
        return ResponseUtil.error(res, error.message, 400);
      }
      return ResponseUtil.error(res, 'Failed to reject filing', 500);
    }
  }
}

export default FilingController; 
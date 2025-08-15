import { FilingRepository, FilingFilters, FilingCreateData, FilingUpdateData, FilingSearchResult } from '../repositories/filing.repository';
import { ClientRepository } from '../repositories/client.repository';
import { UserRepository } from '../repositories/user.repository';
import { Filing } from '../models';
import { FilingStatus, FilingType, FilingPriority, USER_ROLES } from '../utils/constants';
import logger from '../utils/logger';

export interface CreateFilingRequest {
  clientId: number;
  taxYear: string;
  filingType: FilingType;
  priority?: FilingPriority;
  dueDate?: Date;
  notes?: string;
}

export interface UpdateFilingRequest {
  status?: FilingStatus;
  priority?: FilingPriority;
  incomeSourcesJson?: any;
  deductionsJson?: any;
  summaryJson?: any;
  notes?: string;
  dueDate?: Date;
}

export interface FilingStatsResponse {
  total: number;
  draft: number;
  inProgress: number;
  underReview: number;
  completed: number;
  rejected: number;
}

class FilingService {
  private filingRepository: FilingRepository;
  private clientRepository: ClientRepository;
  private userRepository: UserRepository;

  constructor() {
    this.filingRepository = new FilingRepository();
    this.clientRepository = new ClientRepository();
    this.userRepository = new UserRepository();
  }

  async getAllFilings(filters: FilingFilters): Promise<FilingSearchResult> {
    try {
      return await this.filingRepository.findAll(filters);
    } catch (error: any) {
      logger.error('Error fetching filings:', error);
      throw new Error('Failed to fetch filings');
    }
  }

  async getFilingById(id: number): Promise<Filing | null> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid filing ID');
      }

      return await this.filingRepository.findById(id);
    } catch (error: any) {
      logger.error(`Error fetching filing ${id}:`, error);
      if (error.message === 'Invalid filing ID') {
        throw error;
      }
      throw new Error('Failed to fetch filing');
    }
  }

  async getFilingsByClientId(clientId: number, options: { limit?: number; status?: FilingStatus } = {}): Promise<Filing[]> {
    try {
      if (!clientId || clientId <= 0) {
        throw new Error('Invalid client ID');
      }

      // Verify client exists
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      return await this.filingRepository.findByClientId(clientId, options);
    } catch (error: any) {
      logger.error(`Error fetching filings for client ${clientId}:`, error);
      if (error.message === 'Invalid client ID' || error.message === 'Client not found') {
        throw error;
      }
      throw new Error('Failed to fetch client filings');
    }
  }

  async getFilingsByCAId(caId: number, options: { limit?: number; status?: FilingStatus } = {}): Promise<Filing[]> {
    try {
      if (!caId || caId <= 0) {
        throw new Error('Invalid CA ID');
      }

      // Verify CA exists and has correct role
      const ca = await this.userRepository.findById(caId);
      if (!ca) {
        throw new Error('CA not found');
      }

      if (ca.role !== USER_ROLES.CA) {
        throw new Error('User is not a CA');
      }

      return await this.filingRepository.findByCAId(caId, options);
    } catch (error: any) {
      logger.error(`Error fetching filings for CA ${caId}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('not a CA')) {
        throw error;
      }
      throw new Error('Failed to fetch CA filings');
    }
  }

  async createFiling(data: CreateFilingRequest): Promise<Filing> {
    try {
      // Validate required fields
      if (!data.clientId || !data.taxYear || !data.filingType) {
        throw new Error('Client ID, tax year, and filing type are required');
      }

      // Verify client exists
      const client = await this.clientRepository.findById(data.clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      // Check if filing already exists for this client and tax year
      const existingFiling = await this.filingRepository.findAll({
        clientId: data.clientId,
        taxYear: data.taxYear,
        filingType: data.filingType,
        limit: 1,
      });

      if (existingFiling.data.length > 0) {
        throw new Error('Filing already exists for this client, tax year, and filing type');
      }

      // Validate tax year format (YYYY-YYYY)
      const taxYearRegex = /^\d{4}-\d{4}$/;
      if (!taxYearRegex.test(data.taxYear)) {
        throw new Error('Invalid tax year format. Use YYYY-YYYY format');
      }

      const [startYear, endYear] = data.taxYear.split('-').map(Number);
      if (endYear !== startYear + 1) {
        throw new Error('Invalid tax year. End year must be start year + 1');
      }

      // Auto-assign CA if client has one
      const filingData: FilingCreateData = {
        clientId: data.clientId,
        taxYear: data.taxYear,
        filingType: data.filingType,
        status: 'draft',
        priority: data.priority || 'medium',
        notes: data.notes,
        dueDate: data.dueDate,
      };

      if (client.caId) {
        filingData.caId = client.caId;
      }

      const filing = await this.filingRepository.create(filingData);

      logger.info(`Filing created: ${filing.id} for client ${data.clientId}`);
      return filing;
    } catch (error: any) {
      logger.error('Error creating filing:', error);
      if (error.message.includes('required') || 
          error.message.includes('not found') || 
          error.message.includes('already exists') ||
          error.message.includes('Invalid')) {
        throw error;
      }
      throw new Error('Failed to create filing');
    }
  }

  async updateFiling(id: number, data: UpdateFilingRequest): Promise<Filing | null> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid filing ID');
      }

      // Verify filing exists
      const existingFiling = await this.filingRepository.findById(id);
      if (!existingFiling) {
        throw new Error('Filing not found');
      }

      // Validate status transitions
      if (data.status && !this.isValidStatusTransition(existingFiling.status, data.status)) {
        throw new Error(`Invalid status transition from ${existingFiling.status} to ${data.status}`);
      }

      const updateData: FilingUpdateData = { ...data };

      const updatedFiling = await this.filingRepository.update(id, updateData);

      if (updatedFiling) {
        logger.info(`Filing updated: ${id} with status ${data.status || 'no status change'}`);
      }

      return updatedFiling;
    } catch (error: any) {
      logger.error(`Error updating filing ${id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        throw error;
      }
      throw new Error('Failed to update filing');
    }
  }

  async updateFilingStatus(id: number, status: FilingStatus, notes?: string): Promise<Filing | null> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid filing ID');
      }

      // Verify filing exists
      const existingFiling = await this.filingRepository.findById(id);
      if (!existingFiling) {
        throw new Error('Filing not found');
      }

      // Validate status transition
      if (!this.isValidStatusTransition(existingFiling.status, status)) {
        throw new Error(`Invalid status transition from ${existingFiling.status} to ${status}`);
      }

      const updatedFiling = await this.filingRepository.updateStatus(id, status, notes);

      if (updatedFiling) {
        logger.info(`Filing status updated: ${id} from ${existingFiling.status} to ${status}`);
      }

      return updatedFiling;
    } catch (error: any) {
      logger.error(`Error updating filing status ${id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        throw error;
      }
      throw new Error('Failed to update filing status');
    }
  }

  async assignCA(filingId: number, caId: number): Promise<Filing | null> {
    try {
      if (!filingId || filingId <= 0) {
        throw new Error('Invalid filing ID');
      }

      if (!caId || caId <= 0) {
        throw new Error('Invalid CA ID');
      }

      // Verify filing exists
      const filing = await this.filingRepository.findById(filingId);
      if (!filing) {
        throw new Error('Filing not found');
      }

      // Verify CA exists and has correct role
      const ca = await this.userRepository.findById(caId);
      if (!ca) {
        throw new Error('CA not found');
      }

      if (ca.role !== USER_ROLES.CA) {
        throw new Error('User is not a CA');
      }

      if (!ca.isActive) {
        throw new Error('CA is not active');
      }

      const updatedFiling = await this.filingRepository.assignCA(filingId, caId);

      if (updatedFiling) {
        logger.info(`CA ${caId} assigned to filing ${filingId}`);
      }

      return updatedFiling;
    } catch (error: any) {
      logger.error(`Error assigning CA to filing ${filingId}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('not a CA') || error.message.includes('not active')) {
        throw error;
      }
      throw new Error('Failed to assign CA to filing');
    }
  }

  async unassignCA(filingId: number): Promise<Filing | null> {
    try {
      if (!filingId || filingId <= 0) {
        throw new Error('Invalid filing ID');
      }

      // Verify filing exists
      const filing = await this.filingRepository.findById(filingId);
      if (!filing) {
        throw new Error('Filing not found');
      }

      if (!filing.caId) {
        throw new Error('No CA assigned to this filing');
      }

      const updatedFiling = await this.filingRepository.unassignCA(filingId);

      if (updatedFiling) {
        logger.info(`CA unassigned from filing ${filingId}`);
      }

      return updatedFiling;
    } catch (error: any) {
      logger.error(`Error unassigning CA from filing ${filingId}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('No CA assigned')) {
        throw error;
      }
      throw new Error('Failed to unassign CA from filing');
    }
  }

  async deleteFiling(id: number): Promise<boolean> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid filing ID');
      }

      // Verify filing exists
      const filing = await this.filingRepository.findById(id);
      if (!filing) {
        throw new Error('Filing not found');
      }

      // Only allow deletion of draft filings
      if (filing.status !== 'draft') {
        throw new Error('Only draft filings can be deleted');
      }

      const deleted = await this.filingRepository.delete(id);

      if (deleted) {
        logger.info(`Filing deleted: ${id}`);
      }

      return deleted;
    } catch (error: any) {
      logger.error(`Error deleting filing ${id}:`, error);
      if (error.message.includes('Invalid') || error.message.includes('not found') || error.message.includes('Only draft')) {
        throw error;
      }
      throw new Error('Failed to delete filing');
    }
  }

  async getFilingStats(options: { clientId?: number; caId?: number; taxYear?: string } = {}): Promise<FilingStatsResponse> {
    try {
      return await this.filingRepository.getFilingStats(options);
    } catch (error: any) {
      logger.error('Error fetching filing stats:', error);
      throw new Error('Failed to fetch filing statistics');
    }
  }

  async getUpcomingDeadlines(options: { days?: number; caId?: number; clientId?: number } = {}): Promise<Filing[]> {
    try {
      return await this.filingRepository.getUpcomingDeadlines(options);
    } catch (error: any) {
      logger.error('Error fetching upcoming deadlines:', error);
      throw new Error('Failed to fetch upcoming deadlines');
    }
  }

  private isValidStatusTransition(currentStatus: FilingStatus, newStatus: FilingStatus): boolean {
    const validTransitions: Record<FilingStatus, FilingStatus[]> = {
      draft: ['in_progress', 'rejected'],
      in_progress: ['under_review', 'draft', 'rejected'],
      under_review: ['completed', 'in_progress', 'rejected'],
      completed: [], // No transitions from completed
      rejected: ['draft', 'in_progress'],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}

export default FilingService; 
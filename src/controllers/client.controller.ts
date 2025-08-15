import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import ResponseUtil from '../utils/response';
import logger from '../utils/logger';
import ClientService from '../services/client.service';
import { 
  CreateClientRequest, 
  UpdateClientRequest, 
  ClientSearchFilters 
} from '../types/user.types';
import { ClientStatus } from '../utils/constants';

export class ClientController {
  private clientService: ClientService;

  constructor() {
    this.clientService = new ClientService();
  }

  async getAllClients(req: Request, res: Response): Promise<Response> {
    try {
      const filters: ClientSearchFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        status: req.query.status as ClientStatus,
        caId: req.query.caId ? parseInt(req.query.caId as string) : undefined,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await this.clientService.getAllClients(filters);

      return ResponseUtil.paginated(res, result.data, result.pagination);
    } catch (error: any) {
      logger.error('Error fetching clients:', error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch clients', 500);
    }
  }

  async getClientById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const clientId = parseInt(id);

      if (!clientId || isNaN(clientId)) {
        return ResponseUtil.error(res, 'Invalid client ID', 400);
      }

      const client = await this.clientService.getClientById(clientId);

      if (!client) {
        return ResponseUtil.error(res, 'Client not found', 404);
      }

      return ResponseUtil.success(res, client, 'Client retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching client ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch client', 500);
    }
  }

  async getClientByUserId(req: Request, res: Response): Promise<Response> {
    try {
      const { userId } = req.params;
      const userIdNum = parseInt(userId);

      if (!userIdNum || isNaN(userIdNum)) {
        return ResponseUtil.error(res, 'Invalid user ID', 400);
      }

      const client = await this.clientService.getClientByUserId(userIdNum);

      if (!client) {
        return ResponseUtil.error(res, 'Client profile not found for this user', 404);
      }

      return ResponseUtil.success(res, client, 'Client profile retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching client by user ID ${req.params.userId}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch client profile', 500);
    }
  }

  async getClientByPanNumber(req: Request, res: Response): Promise<Response> {
    try {
      const { panNumber } = req.params;

      if (!panNumber) {
        return ResponseUtil.error(res, 'PAN number is required', 400);
      }

      const client = await this.clientService.getClientByPanNumber(panNumber);

      if (!client) {
        return ResponseUtil.error(res, 'Client not found with this PAN number', 404);
      }

      return ResponseUtil.success(res, client, 'Client retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching client by PAN ${req.params.panNumber}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch client', 500);
    }
  }

  async createClient(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const clientData: CreateClientRequest = {
        userId: req.body.userId,
        panNumber: req.body.panNumber,
        aadharNumber: req.body.aadharNumber,
        dateOfBirth: req.body.dateOfBirth,
        address: req.body.address,
        occupation: req.body.occupation,
        annualIncome: req.body.annualIncome,
      };

      const newClient = await this.clientService.createClient(clientData);

      return ResponseUtil.success(res, newClient, 'Client profile created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating client:', error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to create client profile', 500);
    }
  }

  async updateClient(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const { id } = req.params;
      const clientId = parseInt(id);

      if (!clientId || isNaN(clientId)) {
        return ResponseUtil.error(res, 'Invalid client ID', 400);
      }

      const updateData: UpdateClientRequest = {
        caId: req.body.caId,
        aadharNumber: req.body.aadharNumber,
        dateOfBirth: req.body.dateOfBirth,
        address: req.body.address,
        occupation: req.body.occupation,
        annualIncome: req.body.annualIncome,
        status: req.body.status,
        onboardingCompleted: req.body.onboardingCompleted,
        profileJson: req.body.profileJson,
      };

      const updatedClient = await this.clientService.updateClient(clientId, updateData);

      if (!updatedClient) {
        return ResponseUtil.error(res, 'Client not found', 404);
      }

      return ResponseUtil.success(res, updatedClient, 'Client updated successfully');
    } catch (error: any) {
      logger.error(`Error updating client ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to update client', 500);
    }
  }

  async deleteClient(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const clientId = parseInt(id);

      if (!clientId || isNaN(clientId)) {
        return ResponseUtil.error(res, 'Invalid client ID', 400);
      }

      const deleted = await this.clientService.deleteClient(clientId);

      if (!deleted) {
        return ResponseUtil.error(res, 'Client not found', 404);
      }

      return ResponseUtil.success(res, null, 'Client deleted successfully');
    } catch (error: any) {
      logger.error(`Error deleting client ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to delete client', 500);
    }
  }

  async assignCA(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ResponseUtil.validationError(res, errors.array());
      }

      const { id } = req.params;
      const { caId } = req.body;
      const clientId = parseInt(id);

      if (!clientId || isNaN(clientId)) {
        return ResponseUtil.error(res, 'Invalid client ID', 400);
      }

      if (!caId || isNaN(parseInt(caId))) {
        return ResponseUtil.error(res, 'Invalid CA ID', 400);
      }

      const updatedClient = await this.clientService.assignCA(clientId, parseInt(caId));

      if (!updatedClient) {
        return ResponseUtil.error(res, 'Client not found', 404);
      }

      return ResponseUtil.success(res, updatedClient, 'CA assigned successfully');
    } catch (error: any) {
      logger.error(`Error assigning CA to client ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to assign CA', 500);
    }
  }

  async unassignCA(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const clientId = parseInt(id);

      if (!clientId || isNaN(clientId)) {
        return ResponseUtil.error(res, 'Invalid client ID', 400);
      }

      const updatedClient = await this.clientService.unassignCA(clientId);

      if (!updatedClient) {
        return ResponseUtil.error(res, 'Client not found', 404);
      }

      return ResponseUtil.success(res, updatedClient, 'CA unassigned successfully');
    } catch (error: any) {
      logger.error(`Error unassigning CA from client ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to unassign CA', 500);
    }
  }

  async getClientsByCA(req: Request, res: Response): Promise<Response> {
    try {
      const { caId } = req.params;
      const caIdNum = parseInt(caId);

      if (!caIdNum || isNaN(caIdNum)) {
        return ResponseUtil.error(res, 'Invalid CA ID', 400);
      }

      const clients = await this.clientService.getClientsByCA(caIdNum);

      return ResponseUtil.success(res, clients, 'CA clients retrieved successfully');
    } catch (error: any) {
      logger.error(`Error fetching clients for CA ${req.params.caId}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch CA clients', 500);
    }
  }

  async completeOnboarding(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const clientId = parseInt(id);

      if (!clientId || isNaN(clientId)) {
        return ResponseUtil.error(res, 'Invalid client ID', 400);
      }

      const updatedClient = await this.clientService.completeOnboarding(clientId);

      if (!updatedClient) {
        return ResponseUtil.error(res, 'Client not found', 404);
      }

      return ResponseUtil.success(res, updatedClient, 'Client onboarding completed successfully');
    } catch (error: any) {
      logger.error(`Error completing onboarding for client ${req.params.id}:`, error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to complete onboarding', 500);
    }
  }

  async getClientStats(req: Request, res: Response): Promise<Response> {
    try {
      const stats = await this.clientService.getClientStats();

      return ResponseUtil.success(res, stats, 'Client statistics retrieved successfully');
    } catch (error: any) {
      logger.error('Error fetching client stats:', error);
      if (error.statusCode) {
        return ResponseUtil.error(res, error.message, error.statusCode);
      }
      return ResponseUtil.error(res, 'Failed to fetch client statistics', 500);
    }
  }
}

export default ClientController; 